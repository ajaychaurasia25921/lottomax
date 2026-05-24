package com.lottomax.enterprise.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.lottomax.enterprise.model.Money;
import com.lottomax.enterprise.model.WithdrawalDecision;
import com.lottomax.enterprise.model.WithdrawalRequest;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class WalletServiceTest {
    private final WalletService service = new WalletService();

    @Test
    void clearsWithdrawalsUnderFiveThousandInstantly() {
        WithdrawalDecision decision = service.requestWithdrawal(
                UUID.randomUUID(),
                new WithdrawalRequest(new Money(499_900, "USD"), "acct_123")
        );

        assertEquals("instant_processing", decision.status());
    }

    @Test
    void routesWithdrawalsAtFiveThousandToManualReview() {
        WithdrawalDecision decision = service.requestWithdrawal(
                UUID.randomUUID(),
                new WithdrawalRequest(new Money(500_000, "USD"), "acct_123")
        );

        assertEquals("manual_review", decision.status());
    }
}
