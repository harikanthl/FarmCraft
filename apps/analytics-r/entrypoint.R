library(plumber)
port <- as.integer(Sys.getenv("PORT", unset = "8000"))
pr <- plumber::plumb("plumber.R")
pr$run(host = "0.0.0.0", port = port)
