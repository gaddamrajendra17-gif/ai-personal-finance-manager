from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.finance import Group, GroupMember, GroupExpense, Settlement
from pydantic import BaseModel

router = APIRouter(prefix="/api/groups", tags=["Group Expenses"])


class GroupCreate(BaseModel):
    name: str
    members: List[str]  # List of member names


class ExpenseCreate(BaseModel):
    description: str
    amount: float
    paidBy: str
    splitWith: List[str]


def serialize_group(group: Group) -> dict:
    """Helper to serialize Group model into the exact structure required by frontend."""
    expenses_list = []
    for exp in group.expenses:
        try:
            split_with_list = json.loads(exp.split_with)
        except Exception:
            split_with_list = []
            
        settlements_list = []
        for s in exp.settlements:
            settlements_list.append({
                "from": s.from_member,
                "to": s.to_member,
                "amount": s.amount,
                "settled": s.settled
            })
            
        per_person = exp.amount / (len(split_with_list) + 1)
        expenses_list.append({
            "id": str(exp.id),
            "description": exp.description,
            "amount": exp.amount,
            "paidBy": exp.paid_by,
            "splitWith": split_with_list,
            "perPerson": round(per_person, 2),
            "date": exp.date,
            "settlements": settlements_list
        })
        
    return {
        "id": str(group.id),
        "name": group.name,
        "members": [m.name for m in group.members],
        "created": group.created_at.strftime("%d/%m/%Y"),
        "expenses": expenses_list
    }


@router.get("/")
def get_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all groups for the current user."""
    groups = db.query(Group).filter(Group.user_id == current_user.id).all()
    return [serialize_group(g) for g in groups]


@router.post("/")
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new group and add its members."""
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Group name cannot be empty")
        
    # Create group
    group = Group(user_id=current_user.id, name=payload.name)
    db.add(group)
    db.commit()
    db.refresh(group)
    
    # Add members
    for name in payload.members:
        if name.strip():
            db_member = GroupMember(group_id=group.id, name=name.strip())
            db.add(db_member)
            
    db.commit()
    db.refresh(group)
    return serialize_group(group)


@router.post("/{group_id}/expenses")
def add_expense(
    group_id: str,
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a group expense and auto-calculate settlements."""
    group = db.query(Group).filter(Group.id == group_id, Group.user_id == current_user.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
        
    from datetime import datetime
    date_str = datetime.now().strftime("%d/%m/%Y")
    
    # Create group expense
    expense = GroupExpense(
        group_id=group.id,
        description=payload.description,
        amount=payload.amount,
        paid_by=payload.paidBy,
        split_with=json.dumps(payload.splitWith),
        date=date_str
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    
    # Calculate splits
    # Each person pays their portion
    num_people = len(payload.splitWith) + 1
    per_person = round(payload.amount / num_people, 2)
    
    # Generate settlements
    for member in payload.splitWith:
        settlement = Settlement(
            group_expense_id=expense.id,
            from_member=member,
            to_member=payload.paidBy,
            amount=per_person,
            settled=False
        )
        db.add(settlement)
        
    db.commit()
    db.refresh(group)
    return serialize_group(group)


@router.put("/{group_id}/expenses/{expense_id}/settlements/{settlement_idx}/settle")
def settle_expense(
    group_id: str,
    expense_id: str,
    settlement_idx: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a settlement inside an expense as settled."""
    group = db.query(Group).filter(Group.id == group_id, Group.user_id == current_user.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    expense = db.query(GroupExpense).filter(GroupExpense.id == expense_id, GroupExpense.group_id == group.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
        
    # Get settlements sorted by ID to maintain consistent index lookup
    settlements = db.query(Settlement).filter(Settlement.group_expense_id == expense.id).order_by(Settlement.id).all()
    if settlement_idx < 0 or settlement_idx >= len(settlements):
        raise HTTPException(status_code=400, detail="Invalid settlement index")
        
    # Mark it as settled
    settlements[settlement_idx].settled = True
    db.commit()
    
    db.refresh(group)
    return serialize_group(group)


@router.delete("/{group_id}")
def delete_group(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a group."""
    group = db.query(Group).filter(Group.id == group_id, Group.user_id == current_user.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    db.delete(group)
    db.commit()
    return {"status": "deleted"}
