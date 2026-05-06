from database import _ensure_missing_columns

_ensure_missing_columns()

# Check again
from sqlalchemy import create_engine, inspect
engine = create_engine("sqlite:///app.db")
inspector = inspect(engine)

for table in ['xrays', 'analyses']:
    columns = inspector.get_columns(table)
    print(f'{table} columns:', [c['name'] for c in columns])
