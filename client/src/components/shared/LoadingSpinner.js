import React from "react";
import { CircularProgress, Box } from "@mui/material";

const LoadingSpinner = ({ minHeight = "200px" }) => {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight={minHeight}
    >
      <CircularProgress />
    </Box>
  );
};

export default LoadingSpinner;
