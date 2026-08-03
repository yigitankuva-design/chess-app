def test_custom_tab_modeli_tablo_adi_ve_alanlari():
    from chess_api.models import CustomTab

    assert CustomTab.__tablename__ == "custom_tabs"
    cols = set(CustomTab.__table__.columns.keys())
    assert cols == {"id", "order_index", "label", "emoji"}


def test_custom_tab_section_modeli_tablo_adi_ve_alanlari():
    from chess_api.models import CustomTabSection

    assert CustomTabSection.__tablename__ == "custom_tab_sections"
    cols = set(CustomTabSection.__table__.columns.keys())
    assert cols == {"id", "custom_tab_id", "order_index", "title", "body", "images"}
