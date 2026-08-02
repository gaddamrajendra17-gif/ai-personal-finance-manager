with open(r"C:\Users\HP\.gemini\antigravity-ide\brain\65759252-ef9a-4acb-884c-a1e31451d946\.system_generated\tasks\task-1311.log", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i in range(3998, 4040):
    print(f"{i+1}: {lines[i]}", end="")
