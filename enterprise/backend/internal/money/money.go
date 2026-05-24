package money

import "fmt"

type Amount struct {
	Cents    int64  `json:"cents"`
	Currency string `json:"currency"`
}

func New(cents int64, currency string) (Amount, error) {
	if cents < 0 {
		return Amount{}, fmt.Errorf("amount cannot be negative")
	}
	if currency == "" {
		return Amount{}, fmt.Errorf("currency is required")
	}
	return Amount{Cents: cents, Currency: currency}, nil
}

func SplitPlatformWinner(poolCents int64) (companyCents int64, winnerCents int64, err error) {
	if poolCents < 0 {
		return 0, 0, fmt.Errorf("pool cannot be negative")
	}
	companyCents = poolCents * 15 / 100
	winnerCents = poolCents - companyCents
	return companyCents, winnerCents, nil
}
