import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AnnualReport2025 } from "../views/AnnualReport";

export default function AnnualReport2025Page() {
  const navigate = useNavigate();
  const handleClose = useCallback(() => navigate("/"), [navigate]);
  return <AnnualReport2025 onClose={handleClose} />;
}
