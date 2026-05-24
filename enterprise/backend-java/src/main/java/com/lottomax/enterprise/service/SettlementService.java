package com.lottomax.enterprise.service;

import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class SettlementService {
    public PayoutSplit splitPlatformWinner(long poolCents) {
        if (poolCents < 0) {
            throw new IllegalArgumentException("pool cannot be negative");
        }
        long companyCents = poolCents * 15 / 100;
        long winnerCents = poolCents - companyCents;
        return new PayoutSplit(companyCents, winnerCents);
    }
}
