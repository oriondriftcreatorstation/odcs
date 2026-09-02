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

        // Individual folder IDs
        const imageFolderId = '1YPHgDXLYrEz1-o52EQFKVBp5yHikOOca';
        const soundFolderId = '1LWXuSRzD0ZqNRIrFRYDASbjOIqYm9kqo';
        const modelFolderId = '1rMFkHSOaXA-uJwfBOqb9HUbiC4Z3ierq';
        const previewFolderId = '1p0Y83tqPEDloPIFndVJo2g3Kc_OOwQkg';

        async function fetchFilesFromFolder(folderId) {
            const query = `'${folderId}'+in+parents`;
            console.log(`📡 Fetching from folder: ${folderId}`);
            const response = await drive.files.list({
                q: query,
                fields: 'files(id,name,mimeType,size,parents)',
                pageSize: 1000,
            });
            return response.data.files || [];
        }

        // Test each folder individually and return detailed results
        let results = {
            images: { folderId: imageFolderId, success: false, count: 0, error: null },
            sounds: { folderId: soundFolderId, success: false, count: 0, error: null },
            models: { folderId: modelFolderId, success: false, count: 0, error: null },
            previews: { folderId: previewFolderId, success: false, count: 0, error: null },
        };

        // Try each folder
        for (const [key, folderId] of Object.entries({
            images: imageFolderId,
            sounds: soundFolderId,
            models: modelFolderId,
            previews: previewFolderId
        })) {
            try {
                const files = await fetchFilesFromFolder(folderId);
                const filtered = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
                results[key].success = true;
                results[key].count = filtered.length;
                console.log(`✅ ${key}: ${filtered.length} files`);
            } catch (error) {
                results[key].success = false;
                results[key].error = error.message;
                console.error(`❌ ${key}: ${error.message}`);
            }
        }

        // Build combined assets from successful folders
        let allAssets = [];
        let previewFiles = [];

        // Collect assets from successful folders
        for (const key of ['images', 'sounds', 'models']) {
            if (results[key].success) {
                try {
                    const files = await fetchFilesFromFolder(results[key].folderId);
                    const filtered = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
                    allAssets = [...allAssets, ...filtered];
                } catch (e) {
                    // already logged above
                }
            }
        }

        // Get previews if successful
        if (results.previews.success) {
            try {
                const files = await fetchFilesFromFolder(previewFolderId);
                previewFiles = files.filter(f => f.mimeType.startsWith('image/'));
            } catch (e) {
                // already logged above
            }
        }

        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        res.status(200).json({ 
            assets: allAssets,
            previews: previewFiles,
            testResults: results // This will tell us exactly which folders are working
        });

    } catch (error) {
        console.error('❌ Unhandled error:', error.message);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
};
