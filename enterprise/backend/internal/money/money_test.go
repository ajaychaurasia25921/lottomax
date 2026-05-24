package money

import "testing"

func TestSplitPlatformWinner(t *testing.T) {
	tests := []struct {
		name          string
		pool          int64
		wantCompany   int64
		wantWinner    int64
		wantTotal     int64
	}{
		{name: "one hundred dollars", pool: 10000, wantCompany: 1500, wantWinner: 8500, wantTotal: 10000},
		{name: "rounding stays in winner side", pool: 9999, wantCompany: 1499, wantWinner: 8500, wantTotal: 9999},
		{name: "zero pool", pool: 0, wantCompany: 0, wantWinner: 0, wantTotal: 0},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gotCompany, gotWinner, err := SplitPlatformWinner(tc.pool)
			if err != nil {
				t.Fatalf("SplitPlatformWinner returned error: %v", err)
			}
			if gotCompany != tc.wantCompany || gotWinner != tc.wantWinner {
				t.Fatalf("split = company %d, winner %d; want company %d, winner %d", gotCompany, gotWinner, tc.wantCompany, tc.wantWinner)
			}
			if gotCompany+gotWinner != tc.wantTotal {
				t.Fatalf("split total = %d; want %d", gotCompany+gotWinner, tc.wantTotal)
			}
		})
	}
}

func TestSplitPlatformWinnerRejectsNegativePool(t *testing.T) {
	if _, _, err := SplitPlatformWinner(-1); err == nil {
		t.Fatal("expected negative pool to fail")
	}
}
