from zonefactory.checksums import SUMS_NAME, format_sums, sha256_file, write_sums

ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"  # FIPS 180-2, annex B.1


def test_sha256_of_abc(tmp_path):
    (tmp_path / "abc.txt").write_bytes(b"abc")
    assert sha256_file(tmp_path / "abc.txt") == ABC


def test_sums_format_and_order():
    text = format_sums({"b.txt": "2" * 64, "A.txt": "1" * 64, "a.txt": "3" * 64})
    assert text == f"{'1' * 64}  A.txt\n{'3' * 64}  a.txt\n{'2' * 64}  b.txt\n"


def test_write_sums_covers_every_file_but_itself(tmp_path):
    (tmp_path / "z.bin").write_bytes(b"abc")
    (tmp_path / "a.bin").write_bytes(b"")
    sums = write_sums(tmp_path)
    assert set(sums) == {"z.bin", "a.bin"}
    lines = (tmp_path / SUMS_NAME).read_text().splitlines()
    assert lines == [
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  a.bin",
        f"{ABC}  z.bin",
    ]


def test_sums_are_rewritten_without_counting_the_old_file(tmp_path):
    (tmp_path / "x").write_bytes(b"abc")
    write_sums(tmp_path)
    assert set(write_sums(tmp_path)) == {"x"}
