def serialize_user(user: dict) -> dict:
    # 1. Make a copy of user
    res = user.copy()
    
    # 2. Get current course level
    course_level = res.get("course_level", "beginner")
    
    # 3. Handle awarded_crown_units
    raw_crowns = res.get("awarded_crown_units", [])
    filtered_crowns = []
    for item in raw_crowns:
        if isinstance(item, int):
            if course_level == "beginner":
                filtered_crowns.append(item)
        elif isinstance(item, str):
            if "-" in item:
                level, unit_str = item.split("-", 1)
                if level == course_level:
                    try:
                        filtered_crowns.append(int(unit_str))
                    except ValueError:
                        pass
    res["awarded_crown_units"] = filtered_crowns
    
    # 4. Handle max_unlocked_unit
    raw_max = res.get("max_unlocked_unit", 1)
    if isinstance(raw_max, dict):
        res["max_unlocked_unit"] = raw_max.get(course_level, 1)
    else:
        if course_level == "beginner":
            res["max_unlocked_unit"] = raw_max
        else:
            res["max_unlocked_unit"] = 1
            
    # 5. Handle completed_units
    raw_completed = res.get("completed_units", 0)
    if isinstance(raw_completed, dict):
        res["completed_units"] = raw_completed.get(course_level, 0)
    else:
        if course_level == "beginner":
            res["completed_units"] = raw_completed
        else:
            res["completed_units"] = 0
            
    res.pop("password", None)
    return res
