package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/ajaychaurasia25921/lottomax/enterprise/backend/internal/models"
	"github.com/ajaychaurasia25921/lottomax/enterprise/backend/internal/services"
)

type Controller struct {
	Lottery services.LotteryEngine
}

func (c Controller) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /admin/groups", c.createGroup)
	mux.HandleFunc("POST /health", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	return mux
}

func (c Controller) createGroup(w http.ResponseWriter, r *http.Request) {
	var group models.BroadGroup
	if err := json.NewDecoder(r.Body).Decode(&group); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}
	actor := models.AdminActor{ID: r.Header.Get("X-Admin-ID"), IP: r.RemoteAddr}
	if err := c.Lottery.CreateBroadGroup(r.Context(), actor, group); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(group)
}
