;;; init.el --- Project-local Emacs setup for biblereaderapp -*- lexical-binding: t; -*-

;; Usage, from the project root:
;;   emacs -q -l init.el
;;
;; Packages are installed into ./.emacs.d/ so your personal ~/.emacs.d
;; is left untouched.

;;; Code:

(defconst bra-root
  (file-name-directory (or load-file-name buffer-file-name))
  "Root directory of the biblereaderapp project.")

(defconst bra-emacs-dir (expand-file-name ".emacs.d/" bra-root)
  "Where this config keeps its packages and state.")

(setq user-emacs-directory bra-emacs-dir
      package-user-dir (expand-file-name "elpa/" bra-emacs-dir)
      custom-file (expand-file-name "custom.el" bra-emacs-dir)
      default-directory bra-root
      inhibit-startup-screen t
      make-backup-files nil
      create-lockfiles nil)

;;; Packages

(require 'package)
(setq package-archives
      '(("gnu"    . "https://elpa.gnu.org/packages/")
        ("nongnu" . "https://elpa.nongnu.org/nongnu/")
        ("melpa"  . "https://melpa.org/packages/")))
(package-initialize)
(unless package-archive-contents
  (package-refresh-contents))

(require 'use-package)
(setq use-package-always-ensure t)

;;; Basics

(column-number-mode 1)
(show-paren-mode 1)
(electric-pair-mode 1)
(global-auto-revert-mode 1)
(setq-default indent-tabs-mode nil
              tab-width 2
              js-indent-level 2
              css-indent-offset 2)
(add-hook 'prog-mode-hook #'display-line-numbers-mode)

;;; Magit

(use-package magit
  :bind (("C-x g"   . magit-status)
         ("C-c g b" . magit-blame-addition)
         ("C-c g l" . magit-log-buffer-file)))

;;; Treemacs

(use-package treemacs
  :bind (("C-c t" . treemacs)
         ("M-0"   . treemacs-select-window))
  :config
  (setq treemacs-width 32
        treemacs-follow-after-init t
        treemacs-is-never-other-window t)
  (treemacs-follow-mode 1)
  (treemacs-filewatch-mode 1)
  (treemacs-git-mode 'simple))

(use-package treemacs-magit
  :after (treemacs magit))

;;; Startup layout: treemacs on the left, magit-status on the right

(defun bra-startup-layout ()
  "Open treemacs on this project and magit-status beside it."
  (let ((default-directory bra-root))
    (delete-other-windows)
    (magit-status-setup-buffer bra-root)
    (delete-other-windows)
    (require 'treemacs)
    (treemacs-add-and-display-current-project-exclusively)))

(add-hook 'emacs-startup-hook #'bra-startup-layout)

;;; init.el ends here
