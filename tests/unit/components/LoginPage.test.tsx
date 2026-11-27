import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LoginPage from "@/app/login/page";

describe("LoginPage Component", () => {
  it("renders login form fields and institutional branding", () => {
    render(<LoginPage />);

    // Institutional headers & text
    expect(screen.getByText(/institutional portal/i)).toBeInTheDocument();
    expect(screen.getByText(/sign in to portal/i)).toBeInTheDocument();

    // Input fields
    expect(screen.getByLabelText(/institutional email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
  });

  it("toggles password visibility when eye button is clicked", () => {
    render(<LoginPage />);

    const passwordInput = screen.getByLabelText(/^password/i);
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleBtn = screen.getByRole("button", { name: /show password/i });
    fireEvent.click(toggleBtn);

    expect(passwordInput).toHaveAttribute("type", "text");

    const hideBtn = screen.getByRole("button", { name: /hide password/i });
    fireEvent.click(hideBtn);

    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("shows error toast when submitting empty credentials", async () => {
    render(<LoginPage />);

    const submitBtn = screen.getByRole("button", { name: /sign in to portal/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/please enter both your email address and password/i)
    ).toBeInTheDocument();
  });

  it("opens forgot password sheet when clicking Forgot password?", () => {
    render(<LoginPage />);

    const forgotBtn = screen.getByRole("button", { name: /forgot password\?/i });
    fireEvent.click(forgotBtn);

    expect(screen.getByText(/reset password/i)).toBeInTheDocument();
    expect(
      screen.getByText(/enter your registered email address to receive secure password recovery/i)
    ).toBeInTheDocument();
  });
});
