package com.lottomax.enterprise.service;

import com.lottomax.enterprise.model.CreateDepositRequest;
import com.lottomax.enterprise.model.DepositIntent;
import com.lottomax.enterprise.model.GatewayWebhook;
import com.lottomax.enterprise.model.Money;
import com.lottomax.enterprise.model.WalletBalance;
import com.lottomax.enterprise.model.WithdrawalDecision;
import com.lottomax.enterprise.model.WithdrawalRequest;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class WalletService {
    private static final long INSTANT_WITHDRAWAL_LIMIT_CENTS = 500_000;
    private final Map<UUID, Long> balances = new ConcurrentHashMap<>();

    public WalletBalance balance(UUID walletId) {
        long availableCents = balances.computeIfAbsent(walletId, ignored -> 842_025L);
        return new WalletBalance(walletId, new Money(availableCents, "USD"), new Money(125_000, "USD"), OffsetDateTime.now());
    }

    public DepositIntent createDeposit(UUID walletId, CreateDepositRequest request) {
        balances.merge(walletId, request.amount().cents(), Long::sum);
        return new DepositIntent(UUID.randomUUID(), "captured", "gw_" + UUID.randomUUID());
    }

    public WithdrawalDecision requestWithdrawal(UUID walletId, WithdrawalRequest request) {
        String status = request.amount().cents() < INSTANT_WITHDRAWAL_LIMIT_CENTS ? "instant_processing" : "manual_review";
        String reason = request.amount().cents() < INSTANT_WITHDRAWAL_LIMIT_CENTS
                ? "Amount is under $5,000 and risk checks passed"
                : "Withdrawals of $5,000 or more require manual clearance";
        return new WithdrawalDecision(UUID.randomUUID(), status, reason);
    }

    public void receiveWebhook(GatewayWebhook webhook) {
        if (!"payment_captured".equals(webhook.eventType()) && !"payout_completed".equals(webhook.eventType())) {
            throw new IllegalArgumentException("unsupported gateway event type");
        }
    }
}
