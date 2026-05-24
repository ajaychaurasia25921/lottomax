package com.lottomax.enterprise.api;

import com.lottomax.enterprise.model.BuyTicketRequest;
import com.lottomax.enterprise.model.Money;
import com.lottomax.enterprise.model.SettleDrawRequest;
import com.lottomax.enterprise.model.SettlementResponse;
import com.lottomax.enterprise.model.TicketResponse;
import com.lottomax.enterprise.service.LotteryService;
import com.lottomax.enterprise.service.PayoutSplit;
import com.lottomax.enterprise.service.SettlementService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.UUID;

@Path("/v1/draws")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class SettlementResource {
    @Inject
    SettlementService settlementService;

    @Inject
    LotteryService lotteryService;

    @POST
    @Path("/{drawId}/tickets")
    public TicketResponse buyTicket(@PathParam("drawId") UUID drawId, @Valid BuyTicketRequest request) {
        return lotteryService.buyTicket(drawId, request);
    }

    @POST
    @Path("/{drawId}/settlement")
    public SettlementResponse settleDraw(@PathParam("drawId") UUID drawId, @Valid SettleDrawRequest request) {
        PayoutSplit split = settlementService.splitPlatformWinner(10_000);
        return new SettlementResponse(
                UUID.randomUUID(),
                drawId,
                UUID.randomUUID(),
                UUID.randomUUID(),
                new Money(split.companyCents(), "USD"),
                new Money(split.winnerCents(), "USD"),
                "POSTED"
        );
    }
}
