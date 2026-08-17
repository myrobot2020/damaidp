# ==============================================================================
# measures.R — Single Master R Shiny Dashboard (Nikaya-Wise Visualization Filters)
# ==============================================================================
# Location: C:/Users/ADMIN/Desktop/buddha3/frontendoptimised2/measures.r
#
# Features:
# 1. 📊 Sutta Status Audit (Direct read of sutta_status_matrix.csv with DT table)
# 2. 📈 Statistical Discovery Measures (Nikaya-Wise Dynamic Filtering for AN, MN, DN, KN, SN)
# 3. 🤖 Machine Learning & Models (Nikaya-Wise Dynamic Models for lm, PCA, K-Means)
# 4. 🗂️ Experiment History (Timestamped experiment run selector)
# ==============================================================================

library(shiny)
library(jsonlite)
library(stringr)
library(dplyr)
library(tidyr)
library(purrr)
library(ggplot2)
library(broom)
library(DT)

target_dir <- "C:/Users/ADMIN/Desktop/buddha3/frontendoptimised2"
if (dir.exists(target_dir)) setwd(target_dir)

# Read sutta_status_matrix.csv directly
csv_path <- "sutta_status_matrix.csv"
if (!file.exists(csv_path)) {
  stop("Error: sutta_status_matrix.csv not found!")
}

audit_df <- read.csv(csv_path, encoding = "UTF-8", stringsAsFactors = FALSE, check.names = FALSE)
audit_df[] <- lapply(audit_df, function(col) {
  if (is.character(col)) enc2utf8(iconv(col, from = "UTF-8", to = "UTF-8", sub = "")) else col
})

# Extract Tidy Corpus features with explicit Nikaya column
load_pali_terms <- function() {
  json_path <- "pali_terms.json"
  if (file.exists(json_path)) {
    d <- tryCatch(fromJSON(json_path, simplifyVector = TRUE), error = function(e) NULL)
    if (!is.null(d$pali_terms) && length(d$pali_terms) > 0) {
      return(tolower(trimws(as.character(d$pali_terms))))
    }
  }
  c("dhamma", "dukkha", "anicca", "anatta", "nibbana", "sutta", "samadhi", "panna", "sangha", "buddha")
}

extract_tidy_corpus <- function() {
  all_jsons <- c(list.files("..", pattern = "\\.json$", recursive = TRUE, full.names = TRUE), list.files(".", pattern = "\\.json$", recursive = TRUE, full.names = TRUE))
  skip_patterns <- c("feature_rankings.json", "master.json", "frontend_mapping.json", "package.json", "tsconfig.json", "pipeline_config.json", "sutta_status_analytics.json")
  corpus_files <- unique(all_jsons[!basename(all_jsons) %in% skip_patterns & !grepl("experiments/|\\.system_generated/|downloads/|\\.git/|node_modules/|frontend/", all_jsons)])

  pali_words <- load_pali_terms()

  get_toks <- function(txt) {
    if (is.null(txt)) return(character(0))
    if (is.list(txt) || length(txt) > 1) txt <- paste(unlist(txt), collapse = "\n")
    if (!is.character(txt) || nchar(txt) == 0) return(character(0))
    toks <- unlist(str_extract_all(txt, "[\\wÀ-ÖØ-öø-ÿĀ-žḀ-ỿ'-]+"))
    toks[nchar(toks) > 0]
  }

  records_list <- map(corpus_files, function(f) {
    d <- tryCatch(fromJSON(f, simplifyVector = FALSE), error = function(e) NULL)
    if (is.null(d) || !is.list(d)) return(NULL)
    if (is.null(d$sutta) && is.null(d$transcript)) return(NULL)
    
    sid <- if (!is.null(d$sutta_id)) d$sutta_id else basename(dirname(f))
    nik <- if (!is.null(d$nikaya)) toupper(d$nikaya) else {
      prefix <- toupper(str_extract(sid, "^[a-zA-Z]+"))
      if (!is.na(prefix) && prefix %in% c("AN", "MN", "DN", "KN", "SN")) prefix else "AN"
    }
    
    s_toks <- get_toks(d$sutta); c_toks <- get_toks(d$commentary); t_toks <- get_toks(d$transcript)
    s_wc <- length(s_toks); c_wc <- length(c_toks); t_wc <- length(t_toks)
    s_vc <- length(unique(tolower(s_toks))); c_vc <- length(unique(tolower(c_toks))); t_vc <- length(unique(tolower(t_toks)))
    s_str <- if (is.null(d$sutta)) "" else paste(unlist(d$sutta), collapse="\n")
    s_sc <- length(if (nchar(trimws(s_str)) == 0) character(0) else unlist(str_split(s_str, "[.!?]+")))
    pali_ratio <- if (s_wc == 0) 0.0 else (sum(tolower(s_toks) %in% pali_words) / s_wc)
    kg_nodes <- if (is.list(d$knowledge_graph$nodes)) length(d$knowledge_graph$nodes) else 0
    kg_edges <- if (is.list(d$knowledge_graph$edges)) length(d$knowledge_graph$edges) else 0
    
    tibble(
      sutta_id = sid, nikaya = nik, sutta_wc = s_wc, sutta_sc = max(1, s_sc), sutta_vc = s_vc,
      sutta_ttr = if (s_wc == 0) 0 else (s_vc / s_wc),
      comm_wc = c_wc, comm_vc = c_vc, trans_wc = t_wc, trans_vc = t_vc,
      pali_ratio = pali_ratio, kg_nodes = kg_nodes, kg_edges = kg_edges
    )
  })

  bind_rows(compact(records_list))
}

tidy_df <- extract_tidy_corpus()
nikaya_choices <- c("All", sort(unique(c(audit_df$nikaya, tidy_df$nikaya))))

# UI Layout
ui <- fluidPage(
  tags$head(
    tags$style(HTML("
      body { font-family: 'Inter', system-ui, sans-serif; background-color: #f8fafc; color: #0f172a; padding: 15px; }
      .navbar { background-color: #0f172a; border-radius: 6px; }
      .navbar-default .navbar-brand { color: #38bdf8; font-weight: 700; }
      .navbar-default .navbar-nav>li>a { color: #f1f5f9; }
      .navbar-default .navbar-nav>.active>a { background-color: #0284c7 !important; color: white !important; }
      .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 20px; border: 1px solid #e2e8f0; }
      .kpi { background: #0f172a; color: white; border-radius: 8px; padding: 12px; text-align: center; }
      .kpi-num { font-size: 1.6rem; font-weight: 800; color: #38bdf8; }
      .kpi-lbl { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; }
    "))
  ),
  
  navbarPage(
    title = "☸️ Sutta Statistical & ML Explorer",
    
    # TAB 1: SUTTA STATUS AUDIT
    tabPanel("📊 Sutta Status Audit",
      fluidRow(
        column(4, div(class="kpi", div(class="kpi-num", textOutput("kpi_total")), div(class="kpi-lbl", "Total Suttas in CSV"))),
        column(4, div(class="kpi", div(class="kpi-num", style="color:#10b981;", textOutput("kpi_complete")), div(class="kpi-lbl", "COMPLETE Suttas"))),
        column(4, div(class="kpi", div(class="kpi-num", style="color:#f59e0b;", textOutput("kpi_other")), div(class="kpi-lbl", "RAW / GHOST Suttas")))
      ),
      br(),
      sidebarLayout(
        sidebarPanel(
          width = 3,
          h4("🔍 CSV Filters"),
          selectInput("nikaya_filter", "Nikaya:", choices = c("All", sort(unique(audit_df$nikaya))), selected = "All"),
          selectInput("status_filter", "Status:", choices = c("All", sort(unique(audit_df$status))), selected = "All"),
          textInput("search_id", "Search Sutta ID / Title / Folder:", value = ""),
          hr(),
          downloadButton("download_csv", "📥 Export Current View CSV", class = "btn-primary btn-block")
        ),
        mainPanel(
          width = 9,
          div(class="card",
            h4("📈 Asset Availability Percentage Chart (Direct from CSV)"),
            plotOutput("asset_plot", height = "240px")
          ),
          div(class="card",
            h4("📋 Direct Interactive Read of sutta_status_matrix.csv"),
            DTOutput("matrix_dt")
          )
        )
      )
    ),
    
    # TAB 2: STATISTICAL DISCOVERY MEASURES (NIKAYA-WISE FILTERED)
    tabPanel("📈 Statistical Discovery Measures",
      sidebarLayout(
        sidebarPanel(
          width = 3,
          h4("📊 Visualization Filters"),
          selectInput("viz_nikaya_filter", "Filter by Nikaya:", choices = nikaya_choices, selected = "All"),
          hr(),
          selectInput("measure_type", "Choose Measure:", choices = c(
            "Measure 1: Sutta Word Count Distribution" = "m1",
            "Measure 2: Vocabulary Size vs Word Count Scaling" = "m2",
            "Measure 3: Knowledge Graph Nodes vs Edges" = "m3",
            "Measure 4: Pali Canonical Term Density Ratios" = "m4"
          ))
        ),
        mainPanel(
          width = 9,
          div(class="card",
            h4(textOutput("measure_title")),
            plotOutput("measure_plot", height = "520px")
          )
        )
      )
    ),
    
    # TAB 3: MACHINE LEARNING & MODELS (NIKAYA-WISE FILTERED)
    tabPanel("🤖 Machine Learning & Models",
      sidebarLayout(
        sidebarPanel(
          width = 3,
          h4("🤖 ML Model Filters"),
          selectInput("ml_nikaya_filter", "Filter by Nikaya:", choices = nikaya_choices, selected = "All"),
          hr(),
          p(style="font-size:0.85rem; color:#64748b;", "Filters linear regression, PCA component space, and K-Means clusters by the selected Nikaya.")
        ),
        mainPanel(
          width = 9,
          fluidRow(
            column(6,
              div(class="card",
                h4("📉 Linear Model Residual Diagnostics"),
                plotOutput("lm_resid_plot", height = "340px")
              )
            ),
            column(6,
              div(class="card",
                h4("🌌 PCA Component Space & K-Means Clusters"),
                plotOutput("pca_kmeans_plot", height = "340px")
              )
            )
          ),
          div(class="card",
            h4("📋 Feature Dispersion Summary Table (CV Score)"),
            tableOutput("cv_table_out")
          )
        )
      )
    ),
    
    # TAB 4: EXPERIMENT HISTORY
    tabPanel("🗂️ Experiment History",
      sidebarLayout(
        sidebarPanel(
          width = 4,
          h4("🧪 Select Past Experiment Run"),
          uiOutput("exp_selector_ui")
        ),
        mainPanel(
          width = 8,
          div(class="card",
            h4("📂 Experiment Subfolder File Inventory"),
            tableOutput("exp_files_table")
          )
        )
      )
    )
  )
)

server <- function(input, output, session) {
  
  # Tab 1: Audit Filtering (Re-reads CSV dynamically from disk on every update)
  filtered_df <- reactive({
    csv_path <- "sutta_status_matrix.csv"
    if (file.exists(csv_path)) {
      df <- read.csv(csv_path, encoding = "UTF-8", stringsAsFactors = FALSE, check.names = FALSE)
      df[] <- lapply(df, function(col) {
        if (is.character(col)) enc2utf8(iconv(col, from = "UTF-8", to = "UTF-8", sub = "")) else col
      })
    } else {
      df <- audit_df
    }
    if (input$nikaya_filter != "All") df <- df %>% filter(nikaya == input$nikaya_filter)
    if (input$status_filter != "All") df <- df %>% filter(status == input$status_filter)
    if (nchar(trimws(input$search_id)) > 0) {
      q <- trimws(input$search_id)
      df <- df %>% filter(
        grepl(q, sutta_id, ignore.case = TRUE) |
        grepl(q, title, ignore.case = TRUE) |
        grepl(q, folder, ignore.case = TRUE)
      )
    }
    df
  })
  
  output$kpi_total <- renderText({ nrow(filtered_df()) })
  output$kpi_complete <- renderText({ sum(filtered_df()$status == "COMPLETE", na.rm = TRUE) })
  output$kpi_other <- renderText({ sum(filtered_df()$status != "COMPLETE", na.rm = TRUE) })
  
  output$asset_plot <- renderPlot({
    df <- filtered_df()
    if (nrow(df) == 0) return(NULL)
    
    asset_cols <- c("has_sutta_text", "has_commentary", "has_transcript", "has_quiz", "has_knowledge_graph", "has_mp4", "has_srt")
    valid_cols <- intersect(asset_cols, names(df))
    if (length(valid_cols) == 0) return(NULL)
    
    asset_rates <- df %>%
      select(all_of(valid_cols)) %>%
      pivot_longer(cols = everything(), names_to = "asset", values_to = "flag") %>%
      mutate(is_done = tolower(as.character(flag)) %in% c("true", "done", "1")) %>%
      group_by(asset) %>%
      summarise(Rate_Pct = round(sum(is_done, na.rm = TRUE) / n() * 100, 1), .groups = "drop")
    
    ggplot(asset_rates, aes(x = reorder(asset, Rate_Pct), y = Rate_Pct, fill = Rate_Pct)) +
      geom_col(show.legend = FALSE) +
      geom_text(aes(label = paste0(Rate_Pct, "%")), hjust = -0.15, fontface = "bold", size = 4) +
      coord_flip(ylim = c(0, 115)) +
      scale_fill_viridis_c(option = "viridis") +
      labs(x = NULL, y = "Availability Rate (%)") +
      theme_minimal(base_size = 13)
  })
  
  output$matrix_dt <- renderDT({
    datatable(
      filtered_df(),
      options = list(pageLength = 25, autoWidth = TRUE, scrollX = TRUE),
      rownames = FALSE
    )
  })
  
  output$download_csv <- downloadHandler(
    filename = function() { paste0("sutta_status_matrix_export_", format(Sys.time(), "%Y%m%d_%H%M%S"), ".csv") },
    content = function(file) { write.csv(filtered_df(), file, row.names = FALSE) }
  )
  
  # Tab 2: Nikaya-Wise Filtered Statistical Discovery Measures
  filtered_viz_df <- reactive({
    df <- tidy_df
    if (input$viz_nikaya_filter != "All") {
      df <- df %>% filter(nikaya == input$viz_nikaya_filter)
    }
    df
  })
  
  output$measure_title <- renderText({
    nik_str <- if (input$viz_nikaya_filter == "All") "Entire Corpus" else paste("Nikaya:", input$viz_nikaya_filter)
    switch(input$measure_type,
      "m1" = paste("Measure 1: Sutta Text Word Count Distribution (", nik_str, ")"),
      "m2" = paste("Measure 2: Vocabulary Size vs Word Count Scaling (", nik_str, ")"),
      "m3" = paste("Measure 3: Knowledge Graph Node Count vs Edge Count (", nik_str, ")"),
      "m4" = paste("Measure 4: Pali Canonical Term Density Ratio Distribution (", nik_str, ")")
    )
  })
  
  output$measure_plot <- renderPlot({
    df <- filtered_viz_df()
    if (nrow(df) == 0) return(NULL)
    
    switch(input$measure_type,
      "m1" = ggplot(df, aes(x = reorder(sutta_id, sutta_wc), y = sutta_wc, fill = sutta_wc)) +
               geom_col() + coord_flip() + scale_fill_viridis_c(option = "mako") +
               labs(x = "Sutta ID", y = "Word Count") + theme_minimal(base_size = 14),
      "m2" = ggplot(df, aes(x = sutta_wc, y = sutta_vc)) +
               geom_point(color = "#6366f1", size = 4, alpha = 0.8) +
               geom_smooth(method = "lm", color = "#10b981", se = TRUE) +
               labs(x = "Word Count", y = "Vocabulary Size") + theme_minimal(base_size = 14),
      "m3" = ggplot(df, aes(x = kg_nodes, y = kg_edges)) +
               geom_point(color = "#ec4899", size = 4, alpha = 0.8) +
               geom_smooth(method = "lm", color = "#3b82f6", se = FALSE) +
               labs(x = "Nodes", y = "Edges") + theme_minimal(base_size = 14),
      "m4" = ggplot(df, aes(x = pali_ratio)) +
               geom_histogram(bins = 10, fill = "#8b5cf6", color = "white") +
               labs(x = "Pali Term Ratio", y = "Frequency Count") + theme_minimal(base_size = 14)
    )
  })
  
  # Tab 3: Nikaya-Wise Filtered Machine Learning & Models
  filtered_ml_df <- reactive({
    df <- tidy_df
    if (input$ml_nikaya_filter != "All") {
      df <- df %>% filter(nikaya == input$ml_nikaya_filter)
    }
    df
  })
  
  output$lm_resid_plot <- renderPlot({
    df <- filtered_ml_df()
    if (nrow(df) < 3) return(NULL)
    lm_fit <- lm(sutta_wc ~ sutta_sc + sutta_vc + pali_ratio, data = df)
    augmented_lm <- augment(lm_fit)
    ggplot(augmented_lm, aes(x = .fitted, y = .resid)) +
      geom_point(color = "#3b82f6", size = 3) +
      geom_hline(yintercept = 0, linetype = "dashed", color = "red", linewidth = 1) +
      geom_smooth(method = "lm", color = "#10b981", se = FALSE) +
      labs(x = "Fitted Word Count", y = "Residual") + theme_minimal(base_size = 13)
  })
  
  output$pca_kmeans_plot <- renderPlot({
    df <- filtered_ml_df()
    if (nrow(df) < 4) return(NULL)
    num_mat <- df %>% select(where(is.numeric))
    var_cols <- names(which(apply(num_mat, 2, var) > 1e-8))
    if (length(var_cols) < 2) return(NULL)
    
    pca_fit <- prcomp(num_mat %>% select(all_of(var_cols)), scale. = TRUE)
    k_cnt <- min(3, max(1, nrow(df) - 1))
    km_fit <- kmeans(pca_fit$x[, 1:min(2, ncol(pca_fit$x)), drop = FALSE], centers = k_cnt, nstart = 25)
    pca_df <- as_tibble(pca_fit$x) %>% mutate(Cluster = factor(km_fit$cluster))
    
    ggplot(pca_df, aes(x = PC1, y = PC2, color = Cluster)) +
      geom_point(size = 4, alpha = 0.8) +
      scale_color_brewer(palette = "Set1") + scale_fill_brewer(palette = "Set1") +
      labs(x = "PC1", y = "PC2") + theme_minimal(base_size = 13)
  })
  
  output$cv_table_out <- renderTable({
    df <- filtered_ml_df()
    if (nrow(df) == 0) return(NULL)
    df %>%
      select(-nikaya) %>%
      pivot_longer(-sutta_id, names_to = "feature", values_to = "value") %>%
      group_by(feature) %>%
      summarise(
        Mean = round(mean(value, na.rm = TRUE), 2),
        SD = round(sd(value, na.rm = TRUE), 2),
        CV = round(if_else(abs(Mean) < 1e-6, 0, SD / abs(Mean)), 4),
        .groups = "drop"
      ) %>%
      arrange(desc(CV))
  }, striped = TRUE, hover = TRUE)
  
  # Tab 4: Experiment History
  output$exp_selector_ui <- renderUI({
    exp_dirs <- list.dirs("./experiments", recursive = FALSE, full.names = FALSE)
    exps <- exp_dirs[grepl("^exp_\\d{8}_\\d{6}$", exp_dirs)]
    if (length(exps) == 0) exps <- c("current")
    selectInput("selected_exp", "Active Experiment Run:", choices = rev(exps), selected = rev(exps)[1])
  })
  
  output$exp_files_table <- renderTable({
    selected <- input$selected_exp
    if (!is.null(selected)) {
      exp_path <- file.path("./experiments", selected)
      if (dir.exists(exp_path)) {
        files <- list.files(exp_path, full.names = FALSE)
        file_info <- file.info(file.path(exp_path, files))
        return(tibble(
          Filename = files,
          SizeBytes = file_info$size,
          LastModified = format(file_info$mtime, "%Y-%m-%d %H:%M:%S")
        ))
      }
    }
    tibble(Filename = character(0), SizeBytes = numeric(0), LastModified = character(0))
  }, striped = TRUE, hover = TRUE)
}

shiny::runApp(
  appDir = shinyApp(ui = ui, server = server),
  port = 8000,
  host = "0.0.0.0",
  launch.browser = FALSE
)
