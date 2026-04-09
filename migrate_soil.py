# migrate_soil.py
import pandas as pd
from app import app, db, SoilData

def migrate():
    # 1. Load your CSV (Ensure the file name is correct)
    df = pd.read_csv('database/Master_Village_Soil_Data.csv')
    
    with app.app_context():
        print("Starting Data Migration...")
        
        for index, row in df.iterrows():
            # Create a new row object
            entry = SoilData(
                state=row['State'],
                district=row['District'],
                block=row['Block'],
                village=row['Village'],
                n=float(row['N']),
                p=float(row['P']),
                k=float(row['K']),
                ph=float(row['Ph']),
                zn=float(row['Zn']),
                s=float(row['S']),
                soil_color=row['Soilcolor']
            )
            db.session.add(entry)
            
            # Commit every 100 rows to avoid timing out the connection
            if index % 100 == 0:
                db.session.commit()
                print(f"Uploaded {index} records...")

        db.session.commit()
        print("Migration Successful!")

if __name__ == "__main__":
    migrate()