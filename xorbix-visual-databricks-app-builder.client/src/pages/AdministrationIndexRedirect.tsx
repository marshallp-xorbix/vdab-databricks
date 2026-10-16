import { useNavigate } from "react-router-dom";

function AdministrationIndexRedirect() {
  const navigate = useNavigate();

  // Redirect to the administration dashboard page
  navigate("/administration/dashboard", { replace: true });
  return null;
}

export default AdministrationIndexRedirect;
