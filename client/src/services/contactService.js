import api from "./api";

export const blockUser = async (userIdToBlock) => {
    const response = await api.post("/api/users/block", { userIdToBlock });
    return response.data;
};

export const unblockUser = async (userIdToUnblock) => {
    const response = await api.post("/api/users/unblock", { userIdToUnblock });
    return response.data;
};

export const getBlockedUsers = async () => {
    const response = await api.get("/api/users/blocked");
    return response.data;
};

export const muteDM = async (dmId, muted) => {
    const response = await api.post(`/api/users/dm/${dmId}/mute`, { muted });
    return response.data;
};

export const deleteDM = async (dmId) => {
    const response = await api.delete(`/api/users/dm/${dmId}/delete`);
    return response.data;
};
