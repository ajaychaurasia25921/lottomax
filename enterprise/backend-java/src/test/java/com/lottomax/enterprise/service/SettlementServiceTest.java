package com.lottomax.enterprise.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class SettlementServiceTest {
    private final SettlementService service = new SettlementService();

    @Test
    void splitsPoolIntoFifteenPercentCompanyAndEightyFivePercentWinner() {
        PayoutSplit split = service.splitPlatformWinner(10_000);

        assertEquals(1_500, split.companyCents());
        assertEquals(8_500, split.winnerCents());
        assertEquals(10_000, split.companyCents() + split.winnerCents());
    }

    @Test
    void keepsRoundingRemainderWithWinner() {
        PayoutSplit split = service.splitPlatformWinner(9_999);

        assertEquals(1_499, split.companyCents());
        assertEquals(8_500, split.winnerCents());
    }

    @Test
    void rejectsNegativePools() {
        assertThrows(IllegalArgumentException.class, () -> service.splitPlatformWinner(-1));
    }
}
