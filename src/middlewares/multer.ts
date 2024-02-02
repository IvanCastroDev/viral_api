// firebaseAdmin.js
import admin from 'firebase-admin';

admin.initializeApp({
    credential: admin.credential.cert('./src/auth/validationbucket-firebase-adminsdk-9xp72-21168a413f.json'),
    storageBucket: 'validationbucket.appspot.com'
});

export const bucket = admin.storage().bucket();

// uploadController.js
import { Request, Response } from "express";
import fs from 'fs';


const deleteLocalFile = (filePath: string) => {
    fs.unlink(filePath, (err) => {
        if (err) console.error(`Error deleting local file: ${err}`);
    });
};

const uploadFileToStorage = (file: Express.Multer.File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const { path: filePath, filename: fileName, mimetype } = file;
        const cloudFile = bucket.file(fileName);
        const stream = cloudFile.createWriteStream({
            metadata: { contentType: mimetype },
        });

        stream.on('error', (err) => {
            console.error(err);
            reject(err);
        });

        stream.on('finish', async () => {
            try {
                await cloudFile.makePublic();
                resolve(`https://storage.googleapis.com/${bucket.name}/${cloudFile.name}`);
            } catch (err) {
                reject(err);
            }
        });

        fs.createReadStream(filePath).pipe(stream).on('finish', () => deleteLocalFile(filePath));
    });
};

export const uploadImage = async (req: Request, res: Response) => {
    if (!req.file) return res.status(404).json({ status: 'error', message: 'No image found' });

    try {
        const publicUrl = await uploadFileToStorage(req.file);
        res.json({ path: publicUrl });
    } catch (err) {
        res.status(500).send(err instanceof Error ? err.message : 'Unknown error');
    }
};

export const uploadImages = async (req: Request, res: Response) => {
    if (!req.files) {
        return res.status(404).json({ status: 'error', message: 'No images found' });
    }

    const files = req.files as any[];

    try {
        const paths = await Promise.all(files.map(uploadFileToStorage));
        const response = paths.reduce((acc: any, url, index) => {
            acc[files[index].filename.split('.')[0]] = url;
            return acc;
        }, {});
        res.json(response);
    } catch (err) {
        res.status(500).send(err instanceof Error ? err.message : 'Unknown error');
    }
};
