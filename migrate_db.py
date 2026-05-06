import sqlite3
import uuid
from datetime import datetime

def migrate_database():
    conn = sqlite3.connect('app.db')
    cursor = conn.cursor()
    
    # Check existing columns
    cursor.execute('PRAGMA table_info(analyses)')
    analysis_cols = [c[1] for c in cursor.fetchall()]
    print('Analysis columns before:', analysis_cols)
    
    cursor.execute('PRAGMA table_info(xrays)')
    xray_cols = [c[1] for c in cursor.fetchall()]
    print('Xray columns before:', xray_cols)
    
    # Add missing columns to analyses
    missing_analyses = [
        ('study_uid', 'VARCHAR(36) DEFAULT ""'),
        ('gradcam_path', 'VARCHAR DEFAULT ""'),
        ('router_probability', 'DOUBLE PRECISION DEFAULT 0'),
    ]
    
    for col_name, col_def in missing_analyses:
        if col_name not in analysis_cols:
            cursor.execute(f'ALTER TABLE analyses ADD COLUMN {col_name} {col_def}')
            print(f'Added {col_name} to analyses')
    
    # Add missing columns to xrays
    missing_xrays = [
        ('study_uid', 'VARCHAR(36) DEFAULT ""'),
        ('gradcam_path', 'VARCHAR DEFAULT ""'),
        ('fracture', 'BOOLEAN DEFAULT FALSE'),
        ('confidence', 'DOUBLE PRECISION DEFAULT 0'),
        ('model_used', 'VARCHAR DEFAULT "specialist"'),
        ('attention_score', 'DOUBLE PRECISION DEFAULT 0'),
    ]
    
    for col_name, col_def in missing_xrays:
        if col_name not in xray_cols:
            cursor.execute(f'ALTER TABLE xrays ADD COLUMN {col_name} {col_def}')
            print(f'Added {col_name} to xrays')
    
    # Backfill study_uid for existing analyses that don't have it
    cursor.execute('SELECT id, study_uid FROM analyses WHERE study_uid IS NULL OR study_uid = ""')
    analyses_without_uid = cursor.fetchall()
    
    if analyses_without_uid:
        print(f'Found {len(analyses_without_uid)} analyses without study_uid, backfilling...')
        for analysis_id, _ in analyses_without_uid:
            new_uid = str(uuid.uuid4())
            cursor.execute('UPDATE analyses SET study_uid = ? WHERE id = ?', (new_uid, analysis_id))
            print(f'  Set study_uid for analysis {analysis_id}: {new_uid}')
    
    # Backfill study_uid for xrays (use the study_uid from the corresponding analysis)
    cursor.execute('''
        SELECT x.id, a.study_uid 
        FROM xrays x
        LEFT JOIN analyses a ON x.id = a.xray_id
        WHERE (x.study_uid IS NULL OR x.study_uid = "") AND a.study_uid IS NOT NULL
    ''')
    xrays_to_update = cursor.fetchall()
    
    if xrays_to_update:
        print(f'Found {len(xrays_to_update)} xrays without study_uid, backfilling...')
        for xray_id, study_uid in xrays_to_update:
            cursor.execute('UPDATE xrays SET study_uid = ? WHERE id = ?', (study_uid, xray_id))
            print(f'  Set study_uid for xray {xray_id}: {study_uid}')
    
    conn.commit()
    
    # Check again
    cursor.execute('PRAGMA table_info(analyses)')
    analysis_cols = [c[1] for c in cursor.fetchall()]
    print('\nAnalysis columns after:', analysis_cols)
    
    cursor.execute('PRAGMA table_info(xrays)')
    xray_cols = [c[1] for c in cursor.fetchall()]
    print('Xray columns after:', xray_cols)
    
    # Count records with study_uid
    cursor.execute('SELECT COUNT(*) FROM analyses WHERE study_uid != ""')
    count = cursor.fetchone()[0]
    print(f'\nAnalyses with non-empty study_uid: {count}')
    
    cursor.execute('SELECT COUNT(*) FROM xrays WHERE study_uid != ""')
    count = cursor.fetchone()[0]
    print(f'Xrays with non-empty study_uid: {count}')
    
    conn.close()
    print('\nMigration complete!')

if __name__ == '__main__':
    migrate_database()
