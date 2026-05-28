from sqlalchemy import select
from chess_api.models import User


async def test_verify_email_flow(client, db_engine):
    # Use a fresh session for signup
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
    session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        await client.post("/auth/parent/signup", json={
            "email": "verify@test.com",
            "password": "guvenliSifre1",
            "name": "Ve",
        })
        result = await db.execute(select(User).where(User.email == "verify@test.com"))
        user = result.scalar_one()
        token = user.email_verification_token
        assert token is not None

        response = await client.post("/auth/verify-email", json={"token": token})
        assert response.status_code == 200
        assert response.json()["verified"] is True

    # Re-check DB with fresh session
    async with session_factory() as db:
        result = await db.execute(select(User).where(User.email == "verify@test.com"))
        user2 = result.scalar_one()
        assert user2.email_verified is True
        assert user2.email_verification_token is None


async def test_verify_email_bad_token(client):
    response = await client.post("/auth/verify-email", json={"token": "fake"})
    assert response.status_code == 404
