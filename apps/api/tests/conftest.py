import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
from chess_api.database import Base, get_db
from chess_api.main import create_app




# Use in-memory SQLite for tests
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(
        TEST_DB_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db(db_engine):
    session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest.fixture
def app(db_engine):
    """App with get_db override pointing to the test engine."""
    app_instance = create_app()

    async def override_get_db():
        session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
        async with session_factory() as session:
            yield session

    app_instance.dependency_overrides[get_db] = override_get_db
    return app_instance


@pytest_asyncio.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def child_auth(client):
    """Returns (child_token, child_id) via the full parent->child->device->pin flow."""
    # 1. Parent signup
    r = await client.post("/auth/parent/signup", json={
        "email": "childauth@t.com", "password": "guvenli12345", "name": "Parent",
    })
    parent_token = r.json()["access_token"]
    # 2. Create child
    r = await client.post("/children", headers={"Authorization": f"Bearer {parent_token}"},
                          json={"display_name": "Ali", "age": 10, "pin": "1234"})
    child_id = r.json()["id"]
    # 3. Register device
    await client.post("/auth/device/register",
                      headers={"Authorization": f"Bearer {parent_token}"},
                      json={"device_fingerprint": "testdev", "name": "Test"})
    # 4. Child PIN login
    r = await client.post("/auth/child/pin", json={
        "child_profile_id": child_id, "pin": "1234", "device_fingerprint": "testdev",
    })
    return r.json()["access_token"], child_id
