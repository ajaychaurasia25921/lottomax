package com.lottomax.enterprise.service;

import jakarta.enterprise.context.ApplicationScoped;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class AuditService {
    private final List<String> events = new ArrayList<>();

    public synchronized void record(String adminId, String sourceIp, String action) {
        events.add(OffsetDateTime.now() + " admin=" + adminId + " ip=" + sourceIp + " action=" + action);
    }

    public synchronized List<String> events() {
        return List.copyOf(events);
    }
}
