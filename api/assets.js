const { google } = require('googleapis');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        const credentials = process.env.GOOGLE_SERVICE_ACCOUNT;
        if (!credentials) {
            return res.status(500).json({ error: 'Service account credentials missing.' });
        }

        let creds;
        try {
            creds = JSON.parse(credentials);
        } catch (e) {
            return res.status(500).json({ error: 'Invalid service account JSON.' });
        }

        const auth = new google.auth.GoogleAuth({
            credentials: creds,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // Folder IDs
        const assetFolderIds = [
            '1YPHgDXLYrEz1-o52EQFKVBp5yHikOOca',
            '1LWXuSRzD0ZqNRIrFRYDASbjOIqYm9kqo',
            '1rMFkHSOaXA-uJwfBOqb9HUbiC4Z3ierq',
        ];
        const previewFolderId = '1p0Y83tqPEDloPIFndVJo2g3Kc_OOwQkg';

        async function fetchFilesFromFolders(folderIds) {
            if (!folderIds || folderIds.length === 0) return [];
            const query = folderIds.map(id => `'${id}'+in+parents`).join('+or+');
            console.log('📡 Fetching from Drive with query:', query);
            const response = await drive.files.list({
                q: query,
                fields: 'files(id,name,mimeType,size,parents)',
                pageSize: 1000,
            });
            return response.data.files || [];
        }

        // Test: Check if we can get folder metadata
        async function testFolderAccess(folderId) {
            try {
                console.log(`🔍 Testing access to folder: ${folderId}`);
                // Get the folder's metadata
                const response = await drive.files.get({
                    fileId: folderId,
                    fields: 'id,name,webViewLink',
                });
                console.log(`✅ Folder accessible: ${response.data.name}`);
                return true;
            } catch (error) {
                console.error(`❌ Cannot access folder ${folderId}:`, error.message);
                return false;
            }
        }

        // Test preview folder access first
        const previewAccess = await testFolderAccess(previewFolderId);
        console.log(`Preview folder accessible? ${previewAccess}`);

        // Fetch assets
        let assetFiles = [];
        try {
            const assets = await fetchFilesFromFolders(assetFolderIds);
            assetFiles = assets.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
            console.log(`✅ Fetched ${assetFiles.length} assets`);
        } catch (error) {
            console.error('❌ Failed to fetch assets:', error.message);
            return res.status(500).json({ 
                error: 'Failed to fetch assets',
                details: error.message 
            });
        }

        // Fetch previews
        let previewFiles = [];
        if (previewAccess) {
            try {
                const previews = await fetchFilesFromFolders([previewFolderId]);
                previewFiles = previews.filter(f => f.mimeType.startsWith('image/'));
                console.log(`✅ Fetched ${previewFiles.length} previews`);
            } catch (error) {
                console.warn('⚠️ Failed to fetch previews:', error.message);
            }
        } else {
            console.warn('⚠️ Skipping preview fetch – folder not accessible');
        }

        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        res.status(200).json({ 
            assets: assetFiles, 
            previews: previewFiles,
            previewAccess: previewAccess // Let the frontend know if previews are working
        });

    } catch (error) {
        console.error('❌ Unhandled error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
};
