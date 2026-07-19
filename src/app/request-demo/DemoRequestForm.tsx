"use client";

import { FormEvent, useState } from "react";

type SubmissionState =
  | { status: "idle"; message: "" }
  | { status: "loading"; message: string }
  | { status: "success" | "error"; message: string };

export default function DemoRequestForm() {
  const [submission, setSubmission] = useState<SubmissionState>({
    status: "idle",
    message: "",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submission.status === "loading") {
      return;
    }

    const form = event.currentTarget;
    if (!form.reportValidity()) {
      return;
    }

    const data = new FormData(form);
    setSubmission({
      status: "loading",
      message: "Envoi de votre demande…",
    });

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          company: String(data.get("company") ?? ""),
          message: String(data.get("message") ?? ""),
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: unknown;
      } | null;

      if (!response.ok) {
        throw new Error(
          typeof result?.message === "string"
            ? result.message
            : "La demande n’a pas pu être envoyée. Veuillez réessayer.",
        );
      }

      form.reset();
      setSubmission({
        status: "success",
        message: "Merci ! Votre demande a bien été envoyée. Notre équipe vous recontactera rapidement.",
      });
    } catch (error) {
      setSubmission({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "La demande n’a pas pu être envoyée. Veuillez réessayer.",
      });
    }
  }

  return (
    <form
      className="demo-form"
      onSubmit={handleSubmit}
      aria-busy={submission.status === "loading"}
    >
      <div className="form-field">
        <label htmlFor="name">Nom complet</label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={200}
          placeholder="Votre nom"
        />
      </div>

      <div className="form-field">
        <label htmlFor="email">Email professionnel</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={320}
          placeholder="vous@entreprise.com"
        />
      </div>

      <div className="form-field form-field-wide">
        <label htmlFor="company">Entreprise</label>
        <input
          id="company"
          name="company"
          type="text"
          autoComplete="organization"
          maxLength={200}
          placeholder="Nom de votre entreprise"
        />
      </div>

      <div className="form-field form-field-wide">
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          name="message"
          rows={6}
          maxLength={5000}
          placeholder="Parlez-nous de vos besoins, de votre équipe et de vos priorités."
        />
      </div>

      <div className="form-submit form-field-wide">
        <button
          className="button button-dark"
          type="submit"
          disabled={submission.status === "loading"}
        >
          {submission.status === "loading" ? "Envoi en cours…" : "Envoyer ma demande"}
          <i className="bi bi-arrow-right" aria-hidden="true" />
        </button>
        <p>
          Vos coordonnées sont transmises de manière sécurisée à l’équipe DoliGrid afin
          de répondre à votre demande.
        </p>
      </div>

      {submission.status !== "idle" && (
        <p
          className={`form-status form-status-${submission.status} form-field-wide`}
          role={submission.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {submission.message}
        </p>
      )}
    </form>
  );
}
