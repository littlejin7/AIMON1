# Question Data Validation

Run this regression check before merging quiz, stage, miniboss, unitboss, endboss, or training data changes:

```bash
cd backend
python scripts/validate_question_data.py
```

This check is standalone and uses only the Python standard library. It does not require npm, pytest, FastAPI imports, or application startup.

The validator covers:

- JSON parse errors.
- Quiz, miniboss, unitboss, endboss, training, stage lesson, and unit metadata locations.
- Unknown question types.
- Objective question `choices` and `answer`.
- Subjective questions with no `choices`.
- Markdown code block fence balance.
- Legacy `code_block` and split code block fields.
- `unit`, `stage`, and `course_level` mapping against file paths and unit metadata.
