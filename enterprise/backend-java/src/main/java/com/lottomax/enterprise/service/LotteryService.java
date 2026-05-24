package com.lottomax.enterprise.service;

import com.lottomax.enterprise.model.BroadGroupRequest;
import com.lottomax.enterprise.model.BroadGroupResponse;
import com.lottomax.enterprise.model.BuyTicketRequest;
import com.lottomax.enterprise.model.Money;
import com.lottomax.enterprise.model.RiskDashboard;
import com.lottomax.enterprise.model.TicketResponse;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class LotteryService {
    private final Map<UUID, BroadGroupResponse> groups = new ConcurrentHashMap<>();

    public BroadGroupResponse createBroadGroup(BroadGroupRequest request) {
        UUID id = UUID.randomUUID();
        BroadGroupResponse group = new BroadGroupResponse(id, request.name(), "OPEN", request.maxPlayers(), request.ticketPrice());
        groups.put(id, group);
        return group;
    }

    public BroadGroupResponse pauseBroadGroup(UUID groupId) {
        BroadGroupResponse existing = groups.getOrDefault(groupId, new BroadGroupResponse(groupId, "unknown", "OPEN", 20, new Money(2_000, "USD")));
        BroadGroupResponse paused = new BroadGroupResponse(existing.id(), existing.name(), "PAUSED", existing.maxPlayers(), existing.ticketPrice());
        groups.put(groupId, paused);
        return paused;
    }

    public TicketResponse buyTicket(UUID drawId, BuyTicketRequest request) {
        return new TicketResponse(UUID.randomUUID(), drawId, UUID.randomUUID(), request.numberSet(), new Money(2_000, "USD"));
    }

    public RiskDashboard riskDashboard() {
        return new RiskDashboard(new Money(12_842_000, "USD"), 42.0, 17, 9);
    }
}
