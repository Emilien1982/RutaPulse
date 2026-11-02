import json

import pytest

from zonefactory import difficulty

OPL = "\n".join(
    [
        "w30 v1 Tmtb:scale=2 Nn1,n2",
        "w10 v1 Thighway=path,mtb:scale=0 Nn1,n2",
        "w20 v1 Thighway=path,mtb:scale=1+ Nn1,n2",
        "w21 v1 Thighway=path,mtb:scale=1 Nn1,n2",
        "w22 v1 Thighway=path Nn1,n2",
        "w40 v1 Tmtb:scale=1;2 Nn1,n2",
        "w41 v1 Tmtb:scale=1;2 Nn1,n2",
        "w42 v1 Tmtb:scale=s1 Nn1,n2",
        "w43 v1 Tmtb:scale=%20% Nn1,n2",
        "n5 v1 x1.0 y2.0 Tmtb:scale=3",
        "w10 v2 Tmtb:scale=0 Nn1,n2",
    ]
)


@pytest.mark.parametrize("value, level", [("0", 0), ("1+", 1), ("2-", 2), ("6+", 6), (" 3 ", 3)])
def test_parse_level_accepted(value, level):
    assert difficulty.parse_level(value) == level


@pytest.mark.parametrize("value", ["7", "-1", "1;2", "1 ST", "s1", "fixme", "", "1++"])
def test_parse_level_refused(value):
    assert difficulty.parse_level(value) is None


def test_table_from_opl():
    ways, rejected = difficulty.table_from_opl(OPL)
    assert ways == [[10], [20, 21], [30], [], [], [], []]
    assert rejected == {"1;2": 2, "s1": 1, " ": 1}


def test_report_lines():
    ways, rejected = difficulty.table_from_opl(OPL)
    lines = difficulty.report_lines(ways, rejected)
    assert lines[0] == "8 voies avec mtb:scale : S0 1, S1 2, S2 1, S3 0, S4 0, S5 0, S6 0 ; 4 écartées"
    assert "« 1;2 » ×2" in lines[1] and "« s1 » ×1" in lines[1]


def test_write_table_empty(tmp_path):
    ways, rejected = difficulty.table_from_opl("")
    path = tmp_path / "difficulty.json"
    difficulty.write_table(path, ways)
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data == {"formatVersion": 1, "waysByLevel": [[]] * 7}
    assert difficulty.report_lines(ways, rejected) == [
        "0 voies avec mtb:scale : S0 0, S1 0, S2 0, S3 0, S4 0, S5 0, S6 0 ; 0 écartées"
    ]
