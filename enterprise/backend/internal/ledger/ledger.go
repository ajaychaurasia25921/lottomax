package ledger

import (
	"context"
	"fmt"
	"sync"

	"github.com/ajaychaurasia25921/lottomax/enterprise/backend/internal/models"
)

type Writer interface {
	Append(ctx context.Context, entry models.LedgerEntry) error
}

type MemoryWriter struct {
	mu      sync.Mutex
	seen    map[string]struct{}
	Entries []models.LedgerEntry
}

func NewMemoryWriter() *MemoryWriter {
	return &MemoryWriter{seen: map[string]struct{}{}}
}

func (w *MemoryWriter) Append(ctx context.Context, entry models.LedgerEntry) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if entry.IdempotencyKey == "" {
		return fmt.Errorf("ledger idempotency key is required")
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	if _, ok := w.seen[entry.IdempotencyKey]; ok {
		return nil
	}
	w.seen[entry.IdempotencyKey] = struct{}{}
	w.Entries = append(w.Entries, entry)
	return nil
}
