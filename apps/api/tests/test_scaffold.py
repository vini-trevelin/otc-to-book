def test_api_package_imports() -> None:
    import otc_to_book

    assert otc_to_book.__doc__ == "OTC-to-Book API package."
