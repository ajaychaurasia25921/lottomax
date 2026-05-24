package com.lottomax.enterprise.api;

import com.lottomax.enterprise.model.CreateDepositRequest;
import com.lottomax.enterprise.model.DepositIntent;
import com.lottomax.enterprise.model.WalletBalance;
import com.lottomax.enterprise.model.WithdrawalDecision;
import com.lottomax.enterprise.model.WithdrawalRequest;
import com.lottomax.enterprise.service.WalletService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.UUID;

@Path("/v1/wallets")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class WalletResource {
    @Inject
    WalletService walletService;

    @GET
    @Path("/{walletId}/balance")
    public WalletBalance balance(@PathParam("walletId") UUID walletId) {
        return walletService.balance(walletId);
    }

    @POST
    @Path("/{walletId}/deposits")
    public Response createDeposit(@PathParam("walletId") UUID walletId, @Valid CreateDepositRequest request) {
        DepositIntent intent = walletService.createDeposit(walletId, request);
        return Response.status(Response.Status.CREATED).entity(intent).build();
    }

    @POST
    @Path("/{walletId}/withdrawals")
    public Response requestWithdrawal(@PathParam("walletId") UUID walletId, @Valid WithdrawalRequest request) {
        WithdrawalDecision decision = walletService.requestWithdrawal(walletId, request);
        return Response.accepted(decision).build();
    }
}
