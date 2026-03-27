import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*', // Permitir todas las conexiones. Para mayor seguridad, puedes poner el dominio de tu frontend: 'https://rips-frontend-lovat.vercel.app'
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// Static files setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoint for image processing
app.post('/api/process-image', async (req, res) => {
    try {
        const { imageData, mediaType } = req.body;

        if (!imageData) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            console.error('SERVER ERROR: GEMINI_API_KEY is missing in .env');
            return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
        }

        // Call Gemini 2.0 Flash (Experimental)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Extract the following patient data from this image: Fecha, Hora, Nombre, Identidad, Edad. Return a JSON array of objects with these keys. If a field is missing, use an empty string. The response should be raw JSON without markdown formatting." },
                        {
                            inline_data: {
                                mime_type: mediaType || 'image/png',
                                data: imageData
                            }
                        }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            throw new Error('No data returned from AI');
        }

        // Basic cleanup just in case
        const jsonString = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();

        // Parse to verify it's valid JSON before sending
        const patients = JSON.parse(jsonString);

        res.json(patients);

    } catch (error) {
        console.error('Error processing image:', error);
        res.status(500).json({ error: error.message });
    }
});

// Solo iniciar el servidor si no estamos en Vercel (Vercel usa Serverless Functions y no requiere app.listen)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Open http://localhost:${PORT} to view the app`);
    });
}

// Exportar la aplicación para que Vercel la pueda procesar
export default app;
