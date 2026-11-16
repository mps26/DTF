import os
import sys
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env.local", override=True)

from database import get_db_connection, fetchone_dict
from main import (
    app,
    init_auth_db,
    RegisterRequest,
    LoginRequest,
    UpdateProfileRequest,
    ChangePasswordRequest,
    auth_register,
    auth_login,
    auth_update_profile,
    auth_change_password,
    hash_password,
    verify_password,
)

print("=" * 60)
print("  POSTGRESQL AUTHENTICATION VERIFICATION TEST SUITE  ")
print("=" * 60)

# 1. Verify Database Initialization & Schema
print("\n[Step 1] Verifying PostgreSQL Database Initialization & Table Schema...")
init_auth_db()

conn = get_db_connection()
cursor = conn.cursor()

cursor.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
""")
columns = cursor.fetchall()
col_dict = {col[0]: {"data_type": col[1], "is_nullable": col[2]} for col in columns}

required_cols = [
    "id", "name", "email", "company_name", "printer_model",
    "role", "plan", "initials", "avatar_color", "created_at", "password_hash"
]

for col in required_cols:
    assert col in col_dict, f"Missing column: {col}"
    assert col_dict[col]["data_type"] == "text", f"Column {col} should be text, got {col_dict[col]['data_type']}"
    assert col_dict[col]["is_nullable"] == "NO", f"Column {col} should be NOT NULL"

print(f"✓ All {len(required_cols)} required columns present with TEXT NOT NULL in PostgreSQL.")

# Check default users & migrated accounts
cursor.execute("SELECT email, name FROM users ORDER BY email")
existing_users = cursor.fetchall()
print(f"✓ Total users in PostgreSQL: {len(existing_users)}")
for u in existing_users:
    print(f"   - {u[1]} <{u[0]}>")

cursor.close()
conn.close()

# Cleanup any previous test user
test_email = "test_user_postgres@dtflayout.com"
conn = get_db_connection()
cursor = conn.cursor()
cursor.execute("DELETE FROM users WHERE LOWER(email) = LOWER(%s)", (test_email,))
conn.commit()
cursor.close()
conn.close()

# 2. Test User Registration (POST /api/auth/register)
print("\n[Step 2] Testing User Registration in PostgreSQL...")
reg_payload = RegisterRequest(
    name="Priya Sharma",
    email=test_email,
    password="mypassword123",
    companyName="Priya DTF Graphics",
    printerModel='24" Dual Epson i3200'
)

reg_res = auth_register(reg_payload)
assert reg_res["success"] is True, f"Registration failed: {reg_res}"
user = reg_res["user"]
assert user["name"] == "Priya Sharma"
assert user["email"] == test_email.lower()
assert user["companyName"] == "Priya DTF Graphics"
assert user["printerModel"] == '24" Dual Epson i3200'
assert user["initials"] == "PS"
assert "password" not in user
assert "password_hash" not in user
print("✓ User registered successfully and returned sanitized profile object.")

# Verify directly in PostgreSQL
conn = get_db_connection()
cursor = conn.cursor()
cursor.execute("SELECT password_hash FROM users WHERE LOWER(email) = LOWER(%s)", (test_email,))
db_user = cursor.fetchone()
assert db_user is not None, "User not found in PostgreSQL!"
stored_hash = db_user[0]
assert "$" in stored_hash, "Hash should be in salt$hash format"
assert verify_password("mypassword123", stored_hash), "Password verification against stored PBKDF2 hash failed!"
assert not verify_password("wrongpassword", stored_hash), "Wrong password should fail!"
cursor.close()
conn.close()
print("✓ Password hash verified in PostgreSQL using PBKDF2.")

# 3. Test Duplicate Email Rejection
print("\n[Step 3] Testing Duplicate Email Rejection...")
dup_payload = RegisterRequest(
    name="Another Name",
    email=test_email.upper(),  # Test case-insensitivity
    password="differentpass123",
    companyName="Other Company"
)
dup_res = auth_register(dup_payload)
assert dup_res["success"] is False, "Duplicate registration should fail!"
assert "already exists" in dup_res["error"], f"Unexpected error: {dup_res['error']}"
print(f"✓ Duplicate registration rejected correctly: '{dup_res['error']}'")

# 4. Test Login (POST /api/auth/login)
print("\n[Step 4] Testing User Login via PostgreSQL...")
# 4A. Correct password
login_payload = LoginRequest(email=test_email, password="mypassword123")
login_res = auth_login(login_payload)
assert login_res["success"] is True, f"Login failed: {login_res}"
assert login_res["user"]["email"] == test_email.lower()
assert "password" not in login_res["user"]
assert "password_hash" not in login_res["user"]
print("✓ Login succeeded with correct credentials.")

# 4B. Incorrect password
bad_pass_payload = LoginRequest(email=test_email, password="incorrectpassword")
bad_pass_res = auth_login(bad_pass_payload)
assert bad_pass_res["success"] is False
assert "Invalid password" in bad_pass_res["error"]
print(f"✓ Incorrect password rejected correctly: '{bad_pass_res['error']}'")

# 4C. Non-existent email
unknown_payload = LoginRequest(email="nonexistent_xyz_987@dtflayout.com", password="somepassword")
unknown_res = auth_login(unknown_payload)
assert unknown_res["success"] is False
assert "No account found" in unknown_res["error"]
print(f"✓ Non-existent email rejected correctly: '{unknown_res['error']}'")

# 4D. Login with default account
default_login = auth_login(LoginRequest(email="ninad@dtflayout.com", password="password123"))
assert default_login["success"] is True, "Default user ninad@dtflayout.com login failed!"
print("✓ Default user ninad@dtflayout.com logged in successfully via PostgreSQL.")

# 5. Test Profile Update (POST /api/auth/profile)
print("\n[Step 5] Testing Profile Update in PostgreSQL...")
update_payload = UpdateProfileRequest(
    email=test_email,
    name="Priya Sunita Sharma",
    companyName="Sunita & Priya Printworks",
    printerModel="Epson SureColor F2100"
)
update_res = auth_update_profile(update_payload)
assert update_res["success"] is True, f"Profile update failed: {update_res}"
updated_user = update_res["user"]
assert updated_user["name"] == "Priya Sunita Sharma"
assert updated_user["companyName"] == "Sunita & Priya Printworks"
assert updated_user["printerModel"] == "Epson SureColor F2100"
assert updated_user["initials"] == "PS"
print("✓ Profile update succeeded and returned updated profile object.")

# Verify directly in PostgreSQL
conn = get_db_connection()
cursor = conn.cursor()
cursor.execute("SELECT name, company_name, printer_model, initials FROM users WHERE LOWER(email) = LOWER(%s)", (test_email,))
db_row = cursor.fetchone()
assert db_row[0] == "Priya Sunita Sharma"
assert db_row[1] == "Sunita & Priya Printworks"
assert db_row[2] == "Epson SureColor F2100"
assert db_row[3] == "PS"
cursor.close()
conn.close()
print("✓ Updated profile details verified in PostgreSQL database.")

# 6. Test Password Change & Subsequent Login (POST /api/auth/password)
print("\n[Step 6] Testing Password Change in PostgreSQL...")
# 6A. Wrong current password
wrong_change = auth_change_password(ChangePasswordRequest(
    email=test_email,
    currentPassword="wrongpassword",
    newPassword="newsecretpassword999"
))
assert wrong_change["success"] is False
assert "Current password does not match" in wrong_change["error"]
print(f"✓ Wrong current password rejected correctly: '{wrong_change['error']}'")

# 6B. Correct password change
change_res = auth_change_password(ChangePasswordRequest(
    email=test_email,
    currentPassword="mypassword123",
    newPassword="newsecretpassword999"
))
assert change_res["success"] is True, f"Password change failed: {change_res}"
print("✓ Password changed successfully in PostgreSQL.")

# 6C. Old password must fail now
old_login_res = auth_login(LoginRequest(email=test_email, password="mypassword123"))
assert old_login_res["success"] is False, "Old password should no longer work!"
print("✓ Old password successfully invalidated.")

# 6D. New password must succeed
new_login_res = auth_login(LoginRequest(email=test_email, password="newsecretpassword999"))
assert new_login_res["success"] is True, "Login with new password failed!"
print("✓ Login with new password succeeded!")

# Cleanup test user
conn = get_db_connection()
cursor = conn.cursor()
cursor.execute("DELETE FROM users WHERE LOWER(email) = LOWER(%s)", (test_email,))
conn.commit()
cursor.close()
conn.close()
print("✓ Test user cleaned up.")

print("\n" + "=" * 60)
print("  ALL 6 POSTGRESQL AUTHENTICATION TESTS PASSED 100%!  ")
print("=" * 60)
