# migrate_soil.py
import pandas as pd
from app import app, db, SoilData

def migrate():
    # 1. Load your CSV
    df = pd.read_csv('database/Master_Village_Soil_Data.csv')
    
    with app.app_context():
        print("Starting Smart Data Migration (Duplicate Check Enabled)...")
        
        added_count = 0
        skipped_count = 0
        
        for index, row in df.iterrows():
            # Clean data for accurate comparison
            v_name = str(row['Village']).strip().title()
            d_name = str(row['District']).strip().title()
            b_name = str(row['Block']).strip().title()

            # CHECK: Does this record already exist?
            # We check based on Village, Block, and District to be highly specific
            exists = SoilData.query.filter_by(
                village=v_name, 
                block=b_name, 
                district=d_name
            ).first()

            if not exists:
                # Create a new row object only if NOT already present
                entry = SoilData(
                    state=row['State'].strip().title(),
                    district=d_name,
                    block=b_name,
                    village=v_name,
                    n=float(row['N']),
                    p=float(row['P']),
                    k=float(row['K']),
                    ph=float(row['Ph']),
                    zn=float(row['Zn']),
                    s=float(row['S']),
                    soil_color=row['Soilcolor']
                )
                db.session.add(entry)
                added_count += 1
                
                # Commit every 100 NEW rows to manage connection memory
                if added_count % 100 == 0:
                    db.session.commit()
                    print(f"Inserted {added_count} new records...")
            else:
                skipped_count += 1

        # Final commit for the remaining new records
        db.session.commit()
        print("--- Migration Summary ---")
        print(f"Migration Successful! Added: {added_count}, Skipped: {skipped_count}")

if __name__ == "__main__":
    migrate()