
from database import get_db_connection

try:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT current_database(), version();")
    result = cursor.fetchone()

    print("PostgreSQL connected successfully!")
    print("Database:", result[0])
    print("Version:", result[1])

    cursor.close()
    conn.close()

except Exception as e:
    print("Database connection failed:", e)
