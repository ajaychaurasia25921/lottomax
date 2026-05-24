package rng

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"fmt"
)

type Request struct {
	DrawID    string
	TicketIDs []string
	Nonce     string
}

type Service interface {
	Int63(ctx context.Context, request Request) (int64, error)
}

type CryptoService struct{}

func (CryptoService) Int63(ctx context.Context, request Request) (int64, error) {
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	if request.DrawID == "" || len(request.TicketIDs) == 0 {
		return 0, fmt.Errorf("draw ID and ticket IDs are required")
	}
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return 0, fmt.Errorf("secure rng read failed: %w", err)
	}
	return int64(binary.BigEndian.Uint64(b[:]) & ^(uint64(1) << 63)), nil
}
