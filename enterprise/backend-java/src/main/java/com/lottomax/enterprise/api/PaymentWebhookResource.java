package com.lottomax.enterprise.api;

import com.lottomax.enterprise.model.GatewayWebhook;
import com.lottomax.enterprise.service.WalletService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/v1/payment-webhooks")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class PaymentWebhookResource {
    @Inject
    WalletService walletService;

    @POST
    @Path("/gateway")
    public Response receiveGatewayWebhook(@Valid GatewayWebhook webhook) {
        walletService.receiveWebhook(webhook);
        return Response.noContent().build();
    }
}
