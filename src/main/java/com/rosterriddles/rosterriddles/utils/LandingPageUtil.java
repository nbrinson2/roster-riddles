package com.rosterriddles.rosterriddles.utils;

public class LandingPageUtil {

    public static String getConfirmationPage(String link) {
        return "<!DOCTYPE html>" +
                "<html lang=\"en\">" +
                "<head>" +
                "<meta charset=\"UTF-8\">" +
                "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">" +
                "<title>Activation Page</title>" +
                "<link rel=\"stylesheet\" href=\"https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css\">" +
                "<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Bruno+Ace+SC&display=swap\">" +
                "<style>" +
                "body { background-color: black; color: white; }" + // Black background and white text
                "h1 { color: #CC1F41; font-family: 'Bruno Ace SC', cursive; }" + // Updated font-family for header
                ".btn { background-color: #D58181; border-color: #D58181; }" + 
                ".btn:hover { background-color: #68C3F0; border-color: #68C3F0; }" +  // Button hover color
                "</style>" +
                "</head>" +
                "<body>" +
                "<div class=\"container mt-5\">" +
                "<div class=\"row justify-content-center\">" +
                "<div class=\"col-md-8 text-center\">" +
                "<h1>Welcome to Roster Riddles!</h1>" +
                "<p>Your account has been successfully activated.</p>" +
                "<a href=\"" + link + "\" class=\"btn btn-primary\">Get to Guessing!</a>" +
                "</div>" +
                "</div>" +
                "</div>" +
                "</body>" +
                "</html>";
    }

}
