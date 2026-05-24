package audit

import (
	"context"
	"encoding/json"
	"time"
)

type Event struct {
	ID          string          `json:"id"`
	AdminID     string          `json:"adminId"`
	SourceIP    string          `json:"sourceIp"`
	Action      string          `json:"action"`
	Payload     json.RawMessage `json:"payload"`
	OccurredAt  time.Time       `json:"occurredAt"`
}

type Sink interface {
	Record(ctx context.Context, event Event) error
}

type MemorySink struct {
	Events []Event
}

func (s *MemorySink) Record(ctx context.Context, event Event) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.Events = append(s.Events, event)
	return nil
}
