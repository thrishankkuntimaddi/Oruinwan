import api from '@services/api';

export const uploadNoteAttachment = async (file, workspaceId, noteId = null, onProgress = null) => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workspaceId', workspaceId);
        if (noteId) {
            formData.append('noteId', noteId);
        }

        const response = await api.post('/api/upload/note-attachment', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress) {
                    const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                    onProgress(progress);
                }
            },
        });

        return response.data;
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
};

export const downloadNoteAttachment = async (noteId, attachmentId, filename) => {
    try {
        const response = await api.get(
            `/api/v2/notes/${noteId}/attachments/${attachmentId}/download`,
            { responseType: 'blob' }
        );

        
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
};

export const deleteNoteAttachment = async (noteId, attachmentId) => {
    try {
        await api.delete(`/api/v2/notes/${noteId}/attachments/${attachmentId}`);
    } catch (error) {
        console.error('Delete error:', error);
        throw error;
    }
};

export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
