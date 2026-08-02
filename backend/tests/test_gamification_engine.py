import pytest
from app.models.user import User
from app.api.gamification import (
    Badge, UserBadge, Challenge, UserChallenge,
    seed_gamification, calculate_level
)

# 1. Test seed_gamification populates badges
def test_seed_gamification_populates_badges(db_session):
    # Clear badges and challenges first if any
    db_session.query(UserBadge).delete()
    db_session.query(Badge).delete()
    db_session.commit()
    seed_gamification(db_session)
    count = db_session.query(Badge).count()
    assert count > 0
    assert db_session.query(Badge).filter(Badge.key == "first_transaction").first() is not None

# 2. Test seed_gamification populates challenges
def test_seed_gamification_populates_challenges(db_session):
    db_session.query(UserChallenge).delete()
    db_session.query(Challenge).delete()
    db_session.commit()
    seed_gamification(db_session)
    count = db_session.query(Challenge).count()
    assert count > 0
    assert db_session.query(Challenge).filter(Challenge.title == "Save 5000 This Month").first() is not None

# 3. Test seed_gamification is idempotent
def test_seed_gamification_idempotent(db_session):
    seed_gamification(db_session)
    count_badges_1 = db_session.query(Badge).count()
    count_challenges_1 = db_session.query(Challenge).count()
    
    seed_gamification(db_session)
    count_badges_2 = db_session.query(Badge).count()
    count_challenges_2 = db_session.query(Challenge).count()
    
    assert count_badges_1 == count_badges_2
    assert count_challenges_1 == count_challenges_2

# 4. Test calculate_level beginner boundary
def test_calculate_level_beginner():
    info = calculate_level(0)
    assert info["name"] == "Beginner"
    assert info["points_to_next"] == 500
    assert info["next_level"] == "Saver"

# 5. Test calculate_level saver boundary
def test_calculate_level_saver():
    info = calculate_level(500)
    assert info["name"] == "Saver"
    assert info["points_to_next"] == 500
    assert info["next_level"] == "Tracker"

# 6. Test calculate_level tracker boundary
def test_calculate_level_tracker():
    info = calculate_level(1000)
    assert info["name"] == "Tracker"
    assert info["points_to_next"] == 1000
    assert info["next_level"] == "Planner"

# 7. Test calculate_level planner boundary
def test_calculate_level_planner():
    info = calculate_level(2000)
    assert info["name"] == "Planner"
    assert info["points_to_next"] == 2000
    assert info["next_level"] == "Investor"

# 8. Test calculate_level investor boundary
def test_calculate_level_investor():
    info = calculate_level(4000)
    assert info["name"] == "Investor"
    assert info["points_to_next"] == 3000
    assert info["next_level"] == "Wealth Builder"

# 9. Test calculate_level wealth builder boundary
def test_calculate_level_wealth_builder():
    info = calculate_level(7000)
    assert info["name"] == "Wealth Builder"
    assert info["points_to_next"] == 0
    assert info["next_level"] == "Max Level"

# 10. Test calculate_level intermediate points
def test_calculate_level_intermediate():
    info = calculate_level(250)
    assert info["name"] == "Beginner"
    assert info["points_to_next"] == 250
    
    info_pro = calculate_level(8500)
    assert info_pro["name"] == "Wealth Builder"
    assert info_pro["points_to_next"] == 0

# 11. Test profile endpoint requires authentication
def test_get_profile_unauthorized(client):
    response = client.get("/api/gamification/profile")
    assert response.status_code == 401

# 12. Test get profile with empty badges
def test_get_profile_empty_badges(client, auth_headers, db_session):
    # Ensure no badges earned
    db_session.query(UserBadge).delete()
    db_session.commit()
    
    response = client.get("/api/gamification/profile", headers=auth_headers)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["total_points"] == 0
    assert res_data["badges_earned"] == 0
    assert res_data["level"]["name"] == "Beginner"

# 13. Test get profile with earned badges
def test_get_profile_with_badges(client, auth_headers, db_session):
    seed_gamification(db_session)
    user = db_session.query(User).filter(User.email == "testuser@pfm.com").first()
    
    # Award two badges
    ub1 = UserBadge(user_id=user.id, badge_key="first_transaction")
    ub2 = UserBadge(user_id=user.id, badge_key="tracker_10")
    db_session.add_all([ub1, ub2])
    db_session.commit()
    
    response = client.get("/api/gamification/profile", headers=auth_headers)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["badges_earned"] == 2
    # first_transaction = 50, tracker_10 = 100, total = 150 points
    assert res_data["total_points"] == 150

# 14. Test challenges list when not joined
def test_get_challenges_empty(client, auth_headers, db_session):
    seed_gamification(db_session)
    db_session.query(UserChallenge).delete()
    db_session.commit()
    
    response = client.get("/api/gamification/challenges", headers=auth_headers)
    assert response.status_code == 200
    challenges = response.json()
    assert len(challenges) > 0
    for ch in challenges:
        assert ch["joined"] is False
        assert ch["progress"] == 0
        assert ch["completed"] is False

# 15. Test joining challenge successfully
def test_join_challenge_success(client, auth_headers, db_session):
    seed_gamification(db_session)
    challenge = db_session.query(Challenge).first()
    
    # Delete any pre-existing join record
    db_session.query(UserChallenge).filter(UserChallenge.challenge_id == challenge.id).delete()
    db_session.commit()
    
    response = client.post(f"/api/gamification/challenges/{challenge.id}/join", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["message"] == "Joined challenge!"
    
    # Verify it now shows as joined
    res_ch = client.get("/api/gamification/challenges", headers=auth_headers)
    target = next(c for c in res_ch.json() if c["id"] == challenge.id)
    assert target["joined"] is True

# 16. Test joining challenge already joined
def test_join_challenge_already_joined(client, auth_headers, db_session):
    seed_gamification(db_session)
    challenge = db_session.query(Challenge).first()
    
    # First join
    client.post(f"/api/gamification/challenges/{challenge.id}/join", headers=auth_headers)
    # Second join
    response = client.post(f"/api/gamification/challenges/{challenge.id}/join", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["message"] == "Already joined"

# 17. Test joining non-existent challenge
def test_join_challenge_not_found(client, auth_headers):
    response = client.post("/api/gamification/challenges/99999/join", headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Challenge not found"

# 18. Test challenge progress tracking
def test_challenge_progress_tracking(client, auth_headers, db_session):
    seed_gamification(db_session)
    user = db_session.query(User).filter(User.email == "testuser@pfm.com").first()
    challenge = db_session.query(Challenge).first()
    
    # Join challenge and simulate progress
    db_session.query(UserChallenge).filter(UserChallenge.user_id == user.id).delete()
    uc = UserChallenge(user_id=user.id, challenge_id=challenge.id, progress=2500.0, completed=False)
    db_session.add(uc)
    db_session.commit()
    
    response = client.get("/api/gamification/challenges", headers=auth_headers)
    target = next(c for c in response.json() if c["id"] == challenge.id)
    assert target["progress"] == 2500.0
    assert target["completed"] is False

# 19. Test leaderboard sorting
def test_get_leaderboard_sorting(client, auth_headers, db_session):
    # Setup test users and reward points
    seed_gamification(db_session)
    
    # Clear users & user badges first except current
    user_me = db_session.query(User).filter(User.email == "testuser@pfm.com").first()
    db_session.query(UserBadge).delete()
    db_session.query(User).filter(User.email != "testuser@pfm.com").delete()
    db_session.commit()
    
    # User 1: 350 points (saver_10k + first_transaction)
    user1 = User(email="u1@pfm.com", full_name="User One", hashed_password="pw", is_active=True)
    # User 2: 100 points (tracker_10)
    user2 = User(email="u2@pfm.com", full_name="User Two", hashed_password="pw", is_active=True)
    db_session.add_all([user1, user2])
    db_session.commit()
    
    ub1_1 = UserBadge(user_id=user1.id, badge_key="saver_10k")
    ub1_2 = UserBadge(user_id=user1.id, badge_key="first_transaction")
    ub2_1 = UserBadge(user_id=user2.id, badge_key="tracker_10")
    db_session.add_all([ub1_1, ub1_2, ub2_1])
    db_session.commit()
    
    response = client.get("/api/gamification/leaderboard", headers=auth_headers)
    assert response.status_code == 200
    leaderboard = response.json()
    
    assert len(leaderboard) >= 2
    # Leaderboard should be ordered by points descending
    assert leaderboard[0]["name"] == "User One"
    assert leaderboard[0]["points"] == 350
    assert leaderboard[1]["name"] == "User Two"
    assert leaderboard[1]["points"] == 100

# 20. Test leaderboard limit size
def test_get_leaderboard_limit_size(client, auth_headers, db_session):
    seed_gamification(db_session)
    
    # Create 15 users
    for i in range(15):
        email = f"leader_{i}@pfm.com"
        if not db_session.query(User).filter(User.email == email).first():
            u = User(email=email, full_name=f"Leader {i}", hashed_password="pw", is_active=True)
            db_session.add(u)
    db_session.commit()
    
    response = client.get("/api/gamification/leaderboard", headers=auth_headers)
    assert response.status_code == 200
    leaderboard = response.json()
    assert len(leaderboard) <= 10
