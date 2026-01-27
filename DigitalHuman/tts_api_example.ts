import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { jwtSecret, verifyToken } from "../middleware/auth";
import "../firebase"; // Ensure firebase app is initialized

const botnoiToken = defineSecret("BOTNOI_TOKEN");

export const tts = onRequest({ secrets: [jwtSecret, botnoiToken] },
  async (request, response) => {
    // Enable CORS
    response.set("Access-Control-Allow-Origin", "*");
    if (request.method === "OPTIONS") {
      response.set("Access-Control-Allow-Methods", "POST");
      response.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      response.status(204).send("");
      return;
    }

    // JWT Authorization
    try {
      verifyToken(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message.startsWith("Unauthorized")) {
        response.status(401).send({ error: message });
      } else if (message.startsWith("Forbidden")) {
        response.status(403).send({ error: message });
      } else {
        response.status(401).send({ error: "Unauthorized: Invalid token" });
      }
      return;
    }

    if (request.method !== "POST") {
      response.status(405).send({ error: "Method not allowed" });
      return;
    }

    const {
      provider,
      text,
      language,
      speaker,
      command, // Extract 'command' so it is excluded from otherParams
      // Catch-all for other fields provided in body to customize the payload
      ...otherParams
    } = request.body;

    if (!text) {
      response.status(400).send({ error: "Missing 'text' parameter" });
      return;
    }

    if (!provider) {
      response.status(400).send({ error: "Missing 'provider' parameter (google or botnoi)" });
      return;
    }

    try {
      let audioContentBase64 = "";

      if (provider === "google") {
        // --- Google Cloud TTS ---
        const accessToken = await admin.credential.applicationDefault().getAccessToken();
        const token = accessToken.access_token;

        const googlePayload = {
          input: { text },
          voice: {
            languageCode: language || "en-US",
            name: speaker, // Optional, can be undefined
          },
          audioConfig: {
            audioEncoding: "LINEAR16", // Raw PCM (WAV container usually, or just PCM data)
            ...otherParams, // Allow overriding audioConfig properties like sampleRateHertz
          },
        };

        const googleRes = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(googlePayload),
        });

        if (!googleRes.ok) {
          const errText = await googleRes.text();
          logger.error("Google TTS error", errText);
          response.status(googleRes.status).send({ error: "Google TTS failed", details: errText });
          return;
        }

        const googleData = await googleRes.json();
        // audioContent is base64 encoded
        audioContentBase64 = googleData.audioContent;
      } else if (provider.startsWith("botnoi")) {
        // --- BotnoiVoice TTS ---
        const token = botnoiToken.value();
        if (!token) {
          response.status(500).send({ error: "Botnoi token not configured" });
          return;
        }

        const botnoiPayload = {
          text,
          speaker: speaker || "1", // Default speaker if not provided
          language: language || "th",
          volume: otherParams.volume || 1,
          speed: otherParams.speed || 1,
          type_media: otherParams.type_media || "wav", // Prefer wav for PCM compatibility
          save_file: "False",
          ...otherParams,
        };

        // switch between botnoi_v1 and botnoi_v2
        const version = provider.includes("v2") ? "v2" : "v1";
        const botnoi_tts_url = `https://api-voice.botnoi.ai/openapi/${version}/generate_audio`;

        const botnoiRes = await fetch(botnoi_tts_url, {
          method: "POST",
          headers: {
            "Botnoi-Token": token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(botnoiPayload),
        });

        if (!botnoiRes.ok) {
          const errText = await botnoiRes.text();
          logger.error("Botnoi TTS error", errText);
          response.status(botnoiRes.status).send({ error: "Botnoi TTS failed", details: errText });
          return;
        }

        const botnoiData = await botnoiRes.json();
        const audioUrl = botnoiData.audio_url;

        if (!audioUrl) {
          response.status(500).send({ error: "Botnoi did not return audio_url", details: botnoiData });
          return;
        }

        // Fetch the audio file
        const audioFileRes = await fetch(audioUrl);
        if (!audioFileRes.ok) {
          response.status(500).send({ error: "Failed to download audio from Botnoi URL" });
          return;
        }

        const arrayBuffer = await audioFileRes.arrayBuffer();
        audioContentBase64 = Buffer.from(arrayBuffer).toString("base64");
      } else {
        response.status(400).send({ error: "Invalid provider. Must be 'google' or 'botnoi'" });
        return;
      }

      response.send({ content: audioContentBase64 });
    } catch (error) {
      logger.error("TTS function error", error);
      response.status(500).send({ error: "Internal server error" });
    }
  });
