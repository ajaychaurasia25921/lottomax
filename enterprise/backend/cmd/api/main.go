package main

import (
	"context"
	"log"
	"net/http"
	"sync"

	"github.com/ajaychaurasia25921/lottomax/enterprise/backend/internal/audit"
	httpapi "github.com/ajaychaurasia25921/lottomax/enterprise/backend/internal/http"
	"github.com/ajaychaurasia25921/lottomax/enterprise/backend/internal/models"
	"github.com/ajaychaurasia25921/lottomax/enterprise/backend/internal/services"
)

type memoryGroups struct {
	mu     sync.Mutex
	groups map[string]models.BroadGroup
}

func (m *memoryGroups) SaveGroup(ctx context.Context, group models.BroadGroup) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.groups == nil {
		m.groups = map[string]models.BroadGroup{}
	}
	m.groups[group.ID] = group
	return nil
}

func (m *memoryGroups) UpdateGroupStatus(ctx context.Context, groupID string, status models.DrawStatus) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	group := m.groups[groupID]
	group.Status = status
	m.groups[groupID] = group
	return nil
}

func main() {
	controller := httpapi.Controller{
		Lottery: services.LotteryEngine{
			Groups: &memoryGroups{groups: map[string]models.BroadGroup{}},
			Audit:  &audit.MemorySink{},
		},
	}
	log.Println("enterprise backend listening on :8080")
	if err := http.ListenAndServe(":8080", controller.Routes()); err != nil {
		log.Fatal(err)
	}
}
