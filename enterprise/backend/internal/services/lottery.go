package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/ajaychaurasia25921/lottomax/enterprise/backend/internal/audit"
	"github.com/ajaychaurasia25921/lottomax/enterprise/backend/internal/models"
)

type GroupRepository interface {
	SaveGroup(ctx context.Context, group models.BroadGroup) error
	UpdateGroupStatus(ctx context.Context, groupID string, status models.DrawStatus) error
}

type LotteryEngine struct {
	Groups GroupRepository
	Audit  audit.Sink
	Clock  func() time.Time
}

func (e LotteryEngine) CreateBroadGroup(ctx context.Context, actor models.AdminActor, group models.BroadGroup) error {
	if group.Name == "" || group.MaxPlayers <= 0 || group.TicketPriceCents <= 0 || group.Currency == "" {
		return fmt.Errorf("group name, max players, ticket price, and currency are required")
	}
	group.Status = models.DrawOpen
	if err := e.Groups.SaveGroup(ctx, group); err != nil {
		return err
	}
	return e.recordAdmin(ctx, actor, "BROAD_GROUP_CREATE", group)
}

func (e LotteryEngine) PauseBroadGroup(ctx context.Context, actor models.AdminActor, groupID string) error {
	if groupID == "" {
		return fmt.Errorf("group ID is required")
	}
	if err := e.Groups.UpdateGroupStatus(ctx, groupID, models.DrawPaused); err != nil {
		return err
	}
	return e.recordAdmin(ctx, actor, "BROAD_GROUP_PAUSE", map[string]string{"groupId": groupID})
}

func (e LotteryEngine) recordAdmin(ctx context.Context, actor models.AdminActor, action string, payload any) error {
	if e.Audit == nil {
		return nil
	}
	now := time.Now().UTC()
	if e.Clock != nil {
		now = e.Clock().UTC()
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return e.Audit.Record(ctx, audit.Event{
		ID:         action + "_" + now.Format("20060102150405.000000000"),
		AdminID:    actor.ID,
		SourceIP:   actor.IP,
		Action:     action,
		Payload:    raw,
		OccurredAt: now,
	})
}
