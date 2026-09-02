const { google } = require('googleapis');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    try {
        const credentials = process.env.GOOGLE_SERVICE_ACCOUNT;
        if (!credentials) {
            console.error('❌ GOOGLE_SERVICE_ACCOUNT environment variable not set');
            return res.status(500).json({ error: 'Service account credentials missing.' });
        }

        let creds;
        try {
            creds = JSON.parse(credentials);
        } catch (e) {
            console.error('❌ Failed to parse credentials:', e.message);
            return res.status(500).json({ error: 'Invalid service account JSON.' });
        }

        // Auth using service account
        const auth = new google.auth.GoogleAuth({
            credentials: creds,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // Folder IDs
        const folders = [
            { id: '1YPHgDXLYrEz1-o52EQFKVBp5yHikOOca', name: 'images' },
            { id: '1LWXuSRzD0ZqNRIrFRYDASbjOIqYm9kqo', name: 'sounds' },
            { id: '1rMFkHSOaXA-uJwfBOqb9HUbiC4Z3ierq', name: 'models' },
        ];
        const previewFolderId = '1p0Y83tqPEDloPIFndVJo2g3Kc_OOwQkg';

        async function fetchFilesFromFolder(folderId) {
            try {
                const response = await drive.files.list({
                    q: `'${folderId}' in parents`,
                    fields: 'files(id,name,mimeType,size,webContentLink,thumbnailLink)',
                    pageSize: 1000,
                });
                return response.data.files || [];
            } catch (error) {
                console.error(`❌ Error fetching folder ${folderId}:`, error.message);
                // If it fails, return empty array
                return [];
            }
        }

        // Fetch all folders in parallel
        console.log('🔍 Fetching assets from Drive...');
        const [imageFiles, soundFiles, modelFiles, previewFiles] = await Promise.all([
            fetchFilesFromFolder(folders[0].id),
            fetchFilesFromFolder(folders[1].id),
            fetchFilesFromFolder(folders[2].id),
            fetchFilesFromFolder(previewFolderId),
        ]);

        // Filter out actual folders (just in case)
        const images = imageFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
        const sounds = soundFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
        const models = modelFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
        const previews = previewFiles.filter(f => f.mimeType.startsWith('image/'));

        const allAssets = [...images, ...sounds, ...models];

        console.log(`✅ Images: ${images.length}, Sounds: ${sounds.length}, Models: ${models.length}, Previews: ${previews.length}`);
        console.log(`✅ Total assets: ${allAssets.length}`);

        // Cache on Vercel's CDN for 5 minutes
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

        res.status(200).json({ 
            assets: allAssets, 
            previews: previewFiles,
            counts: {
                images: images.length,
                sounds: sounds.length,
                models: models.length,
                previews: previewFiles.length
            }
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
