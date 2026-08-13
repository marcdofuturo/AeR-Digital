import { describe, expect, it } from "vitest";
import { extractIncomingEvolutionMessage } from "./evolution-message";

describe("extractIncomingEvolutionMessage", () => {
  it("treats audio sent as a WhatsApp document as an audio upload", () => {
    expect(extractIncomingEvolutionMessage({
      key: {
        id: "MSG-AUDIO-1",
        fromMe: false,
        remoteJidAlt: "5511999999999@s.whatsapp.net",
      },
      message: {
        documentMessage: {
          fileName: "MC GH, MC Jacare - Minha Musica Incrivel.wav",
          mimetype: "audio/wav",
          url: "https://evolution.example/audio.enc",
        },
      },
    })).toMatchObject({
      phone: "5511999999999",
      text: "[AUDIO] MC GH, MC Jacare - Minha Musica Incrivel.wav",
      mediaKind: "audio",
      mediaUrl: "https://evolution.example/audio.enc",
      fileName: "MC GH, MC Jacare - Minha Musica Incrivel.wav",
      messageId: "MSG-AUDIO-1",
      mimeType: "audio/wav",
    });
  });

  it("treats cover art sent as a WhatsApp document as an image upload", () => {
    expect(extractIncomingEvolutionMessage({
      key: {
        fromMe: false,
        remoteJid: "5511888888888@s.whatsapp.net",
      },
      message: {
        documentMessage: {
          fileName: "capa.jpg",
          mimetype: "image/jpeg",
          url: "https://evolution.example/cover.enc",
        },
      },
    })).toMatchObject({
      phone: "5511888888888",
      text: "[IMAGE] capa.jpg",
      mediaKind: "image",
      mediaUrl: "https://evolution.example/cover.enc",
      fileName: "capa.jpg",
      mimeType: "image/jpeg",
    });
  });

  it("reads documents wrapped with captions", () => {
    expect(extractIncomingEvolutionMessage({
      key: {
        fromMe: false,
        remoteJid: "5511777777777@s.whatsapp.net",
      },
      message: {
        documentWithCaptionMessage: {
          message: {
            documentMessage: {
              fileName: "DJ Teste - Faixa Nova.mp3",
              mimetype: "audio/mpeg",
              url: "https://evolution.example/wrapped-audio.enc",
            },
          },
        },
      },
    })).toMatchObject({
      phone: "5511777777777",
      text: "[AUDIO] DJ Teste - Faixa Nova.mp3",
      mediaKind: "audio",
      mediaUrl: "https://evolution.example/wrapped-audio.enc",
    });
  });
});
