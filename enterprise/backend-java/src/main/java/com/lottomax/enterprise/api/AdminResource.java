package com.lottomax.enterprise.api;

import com.lottomax.enterprise.model.BroadGroupRequest;
import com.lottomax.enterprise.model.BroadGroupResponse;
import com.lottomax.enterprise.model.RiskDashboard;
import com.lottomax.enterprise.service.AuditService;
import com.lottomax.enterprise.service.LotteryService;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.UUID;

@Path("/v1/admin")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class AdminResource {
    @Inject
    LotteryService lotteryService;

    @Inject
    AuditService auditService;

    @POST
    @Path("/broad-groups")
    public Response createBroadGroup(
            @HeaderParam("X-Admin-ID") String adminId,
            @HeaderParam("X-Forwarded-For") String sourceIp,
            @Valid BroadGroupRequest request
    ) {
        BroadGroupResponse response = lotteryService.createBroadGroup(request);
        auditService.record(adminId, sourceIp, "BROAD_GROUP_CREATE");
        return Response.status(Response.Status.CREATED).entity(response).build();
    }

    @POST
    @Path("/broad-groups/{groupId}/pause")
    public BroadGroupResponse pauseBroadGroup(
            @HeaderParam("X-Admin-ID") String adminId,
            @HeaderParam("X-Forwarded-For") String sourceIp,
            @PathParam("groupId") UUID groupId
    ) {
        auditService.record(adminId, sourceIp, "BROAD_GROUP_PAUSE");
        return lotteryService.pauseBroadGroup(groupId);
    }

    @GET
    @Path("/risk-dashboard")
    public RiskDashboard riskDashboard() {
        return lotteryService.riskDashboard();
    }
}
